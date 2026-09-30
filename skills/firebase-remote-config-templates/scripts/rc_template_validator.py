#!/usr/bin/env python3
"""Offline validator and canonicalizer for Firebase Remote Config templates.

Enforces parity with the Firebase Console web validators and Remote Config
backend across parameter keys, global uniqueness, condition names, condition
references, conditionalValues key ordering, value datatypes, oneof constraints,
rollout bounds, targeting expression grammar, and logical condition precedence
shadowing detection.
Supports deterministic auto-remediation for conditionalValues key ordering
(--fix-order), raw JSON primitive value coercion (--fix-types), and dangling
condition reference removal (--prune-dangling).
"""

import argparse
import dataclasses
import json
import re
import sys
from typing import Any

# Parameter, condition, and numeric format patterns
PARAMETER_NAME_REGEX = re.compile(r'^[a-zA-Z_][0-9a-zA-Z_]*$')
CONDITION_NAME_REGEX = re.compile(r"^[-_0-9a-zA-Z '!%.]+$")
NUMERIC_REGEX = re.compile(r'^-?(?:\d*\.)?\d+$')
STRICT_BACKEND_NUMERIC_REGEX = re.compile(r'^-?\d+(?:\.\d+)?$')
LOCAL_DATETIME_REGEX = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$')
MAX_OR_CLAUSES_ALLOWED = 10

# Reserved JavaScript prototype and object keys
RESERVED_JS_KEYWORDS = frozenset({
    '__proto__',
    'constructor',
    'prototype',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    'toString',
    'valueOf',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
})

# Supported condition display tag colors
VALID_TAG_COLORS = frozenset({
    'BLUE',
    'BROWN',
    'CYAN',
    'DEEP_ORANGE',
    'DEEPORANGE',
    'GREEN',
    'INDIGO',
    'LIME',
    'ORANGE',
    'PINK',
    'PURPLE',
    'TEAL',
    'CONDITION_DISPLAY_COLOR_UNSPECIFIED',
})

VALID_VALUE_TYPES = frozenset({'STRING', 'BOOLEAN', 'NUMBER', 'JSON'})
VALUE_ONEOF_FIELDS = (
    'value',
    'useInAppDefault',
    'personalizationValue',
    'rolloutValue',
    'experimentValue',
)
DYNAMIC_VALUE_FIELDS = (
    'personalizationValue',
    'rolloutValue',
    'experimentValue',
)

# Template resource limits
MAX_PARAMETER_NAME_LENGTH = 256
MAX_PARAMETER_DESCRIPTION_LENGTH = 256
MAX_PARAMETER_COUNT = 3000
MAX_PARAMETER_GROUP_KEY_LENGTH = 256
MAX_PARAMETER_GROUP_DESCRIPTION_LENGTH = 256
MAX_PARAMETER_GROUP_COUNT = 1000
MAX_CONDITION_COUNT = 2000
MAX_CONDITION_NAME_LENGTH = 256
MAX_VERSION_DESCRIPTION_LENGTH = 1024
MAX_CONDITION_ATOMS = 50
MAX_ROLLOUT_MICRO_PERCENT = 100_000_000
MAX_PARTIAL_ROLLOUT_MICRO_PERCENT = 50_000_000
MAX_PERCENT_SEED_LENGTH = 32

# Targeting expression operand patterns
PERCENT_SEED_REGEX = re.compile(r'^[\w.-]*$')
CUSTOM_OR_USER_PROP_NUMERIC_REGEX = re.compile(
    r'^[-+]?[0-9]{0,20}(?:\.[0-9]{0,10})?$'
)
CUSTOM_SIGNAL_SEMVER_REGEX = re.compile(r'^[0-9]+(?:\.[0-9]+){0,4}$')
NUMERIC_VERSION_REGEX = re.compile(r'^\d+(?:[\d.]*\d)?$')
FID_VALIDATION_REGEX = re.compile(
    r'^[cdef][\w-]{9}(?:[AEIMQUYcgkosw048]|[\w-]{12})$'
)

STRING_INFIX_CUSTOM_OR_USER_PROP_RE = re.compile(
    r"app\.(?:customSignal|userProperty)\['[^']+'\]\s*(?:==|!=|<=|>=|<|>)\s*'[^']*'"
)
NUMERIC_INFIX_CUSTOM_OR_USER_PROP_RE = re.compile(
    r"^app\.(?:customSignal|userProperty)\['[^']+'\]\s*(?:==|!=|<=|>=|<|>)\s*(.+)$"
)
SEMVER_CUSTOM_SIGNAL_RE = re.compile(
    r"^version\(app\.customSignal\['[^']+'\]\)\s*(?:==|!=|<=|>=|<|>)\s*'([^']*)'$"
)
APP_VERSION_OR_BUILD_NUMERIC_OP_RE = re.compile(
    r"^app\.(?:version|build)\.\s*(?:==|!=|<=|>=|<|>)\s*\(\s*\[((?:'[^']*'|[^\]])*)\]\s*\)$"
)
FID_IN_CLAUSE_RE = re.compile(
    r'^app\.firebaseInstallationId\s+in\s+\[([^\]]+)\]$'
)
COUNTRY_OR_LANGUAGE_IN_RE = re.compile(
    r'^device\.(country|language)\s+in\s+\[([^\]]+)\]$'
)
MATCHES_CLAUSE_RE = re.compile(
    r"\.matches\s*\(\s*\[((?:'[^']*'|[^\]])*)\]\s*\)"
)
DATETIME_ARG_RE = re.compile(
    r"(?:dateTime|app\.firstOpenTimestamp\s*(?:<=|>))\s*\(\s*'([^']*)'"
)
COUNTRY_OR_LANGUAGE_NOT_IN_RE = re.compile(
    r'\bdevice\.(?:country|language)\b.*(?:\bnotIn\b|!=)'
)
PERCENT_CLAUSE_RE = re.compile(
    r"^percent(?:\('([^']*)'\))?\s*(?:((?:<=|>)\s*([+-]?\d+(?:\.\d+)?))|(between\s+([+-]?\d+(?:\.\d+)?)\s+and\s+([+-]?\d+(?:\.\d+)?)))$"
)
HALLUCINATED_OS_RE = re.compile(r'\bapp\.operatingSystem\b|device\.os\s*!=')
HALLUCINATED_AUDIENCES_RE = re.compile(
    r'\bapp\.audiences\s*(?:in\b|==|!=|\.(?:notIn|inAll|notInAll|notInAtLeastOne)\s*\()'
)
HALLUCINATED_PERCENT_FN_RE = re.compile(r'^percent\s*\([^)]*,[^)]*\)$')
HALLUCINATED_VERSION_BUILD_RE = re.compile(
    r'^app\.(?:version|build)\s*(?:(?:==|!=|<=|>=|<|>)|\.'
    r'(?:exactlyMatches|contains|startsWith|endsWith|regex|matches|notContains|==|!=|<=|>=|<|>)'
    r"\(\s*'[^']*'\s*\))"
)
HALLUCINATED_STRING_METHOD_RE = re.compile(
    r'\.(?:regex|startsWith|endsWith)\s*\('
)
HALLUCINATED_FIRST_OPEN_RE = re.compile(
    r'^(?:firstOpenTimestamp\b|app\.firstOpenTimestamp\s*(?:<|>=|==)|'
    r'app\.firstOpenTimestamp\s*(?:<=|>)\s*(?:dateTime\b|\d+))'
)
HALLUCINATED_BARE_FID_RE = re.compile(r'^firebaseInstallationId\b')
ALLOWLISTED_TARGETING_CLAUSE_RE = re.compile(
    r'^(?:'
    r'true|'
    r"device\.os\s*==\s*'(?:android|ios|web)'|"
    r'device\.(?:country|language)\s+in\s+\[[^\]]+\]|'
    r"device\.category\.\s*(?:contains|notContains)\s*\(\s*\['Mobile'\]\s*\)|"
    r'app\.operatingSystemAndVersion\.inOne\(\s*\[(?:'
    r"operatingSystemName\('[^']+'\)\.(?:anyVersion|version\.(?:==|!=|<=|>=|<|>)\('[^']+'\))(?:\s*,\s*operatingSystemName\('[^']+'\)\.(?:anyVersion|version\.(?:==|!=|<=|>=|<|>)\('[^']+'\)))*"
    r')\]\s*\)|'
    r'app\.browserAndVersion\.inOne\(\s*\[(?:'
    r"browserName\('[^']+'\)\.(?:anyVersion|version\.(?:==|!=|<=|>=|<|>)\('[^']+'\))(?:\s*,\s*browserName\('[^']+'\)\.(?:anyVersion|version\.(?:==|!=|<=|>=|<|>)\('[^']+'\)))*"
    r')\]\s*\)|'
    r"app\.id\s*==\s*'[^']+'|"
    r"app\.(?:version|build)\.\s*(?:exactlyMatches|contains|notContains|matches|==|!=|<=|>=|<|>)\s*\(\s*\[(?:'[^']*'|[^\]])*\]\s*\)|"
    r'app\.audiences\.\s*inAtLeastOne\s*\(\s*\[[^\]]+\]\s*\)|'
    r'app\.(?:importedSegments|customAudiences)\.\s*(?:inAtLeastOne|notInAtLeastOne|inAll|inNone)\s*\(\s*\[[^\]]+\]\s*\)|'
    r"app\.(?:userProperty|customSignal)\['[^']+'\]\.\s*(?:exactlyMatches|contains|notContains|matches)\s*\(\s*\[(?:'[^']*'|[^\]])+\]\s*\)|"
    r"app\.(?:userProperty|customSignal)\['[^']+'\]\s*(?:==|!=|<=|>=|<|>)\s*.+|"
    r"version\(app\.customSignal\['[^']+'\]\)\s*(?:==|!=|<=|>=|<|>)\s*'[^']*'|"
    r"percent(?:\('[^']*'\))?\s*(?:(?:<=|>)\s*[+-]?\d+(?:\.\d+)?|between\s+[+-]?\d+(?:\.\d+)?\s+and\s+[+-]?\d+(?:\.\d+)?)|"
    r"dateTime\s*(?:<|>=)\s*dateTime\(\s*'[^']+'(?:\s*,\s*'[^']+')?\s*\)|"
    r"app\.firstOpenTimestamp\s*(?:<=|>)\s*\(\s*'[^']+'(?:\s*,\s*'[^']+')?\s*\)|"
    r'app\.firebaseInstallationId\s+in\s+\[[^\]]+\]'
    r')$'
)
CLIENT_ONLY_SIGNAL_RE = re.compile(
    r'\b(?:device\.(?:os|country|language|category)|'
    r'app\.(?:id|version|build|audiences|importedSegments|customAudiences|operatingSystemAndVersion|browserAndVersion|userProperty|firebaseInstallationId|firstOpenTimestamp)|'
    r'firebaseInstallationId|firstOpenTimestamp|dateTime)\b'
)
IN_LIST_CLAUSE_RE = re.compile(r'^([a-zA-Z0-9_.]+)\s+in\s+\[([^\]]+)\]$')
PERCENT_LE_CLAUSE_RE = re.compile(r'^percent\s*<=\s*(\d+(?:\.\d+)?)$')


@dataclasses.dataclass
class Finding:
  rule_id: str
  severity: str  # 'ERROR' or 'WARNING'
  path: str
  message: str


def _strip_single_quoted_strings(expr: str) -> str:
  return re.sub(r"'(?:\\'|[^'])*'", "''", expr)


def _split_and_clauses(expr: str) -> list[str]:
  """Splits a condition expression on top-level && operators."""
  clauses: list[str] = []
  current: list[str] = []
  in_quote = False
  bracket_depth = 0
  paren_depth = 0
  i = 0
  while i < len(expr):
    ch = expr[i]
    if ch == "'" and (i == 0 or expr[i - 1] != '\\'):
      in_quote = not in_quote
      current.append(ch)
      i += 1
    elif not in_quote and ch == '[':
      bracket_depth += 1
      current.append(ch)
      i += 1
    elif not in_quote and ch == ']':
      bracket_depth = max(0, bracket_depth - 1)
      current.append(ch)
      i += 1
    elif not in_quote and ch == '(':
      paren_depth += 1
      current.append(ch)
      i += 1
    elif not in_quote and ch == ')':
      paren_depth = max(0, paren_depth - 1)
      current.append(ch)
      i += 1
    elif (
        not in_quote
        and bracket_depth == 0
        and paren_depth == 0
        and expr[i : i + 2] == '&&'
    ):
      clauses.append(''.join(current).strip())
      current = []
      i += 2
    else:
      current.append(ch)
      i += 1
  tail = ''.join(current).strip()
  if tail:
    clauses.append(tail)
  return clauses


def _clause_subsumes(broad_clause: str, narrow_clause: str) -> bool:
  """Returns True if broad_clause is satisfied whenever narrow_clause holds."""
  norm_broad = ' '.join(broad_clause.split())
  norm_narrow = ' '.join(narrow_clause.split())
  if norm_broad == norm_narrow:
    return True

  # Check `field in ['US', 'CA']` subsuming `field in ['US']`
  m_broad = IN_LIST_CLAUSE_RE.match(norm_broad)
  m_narrow = IN_LIST_CLAUSE_RE.match(norm_narrow)
  if m_broad and m_narrow and m_broad.group(1) == m_narrow.group(1):
    broad_items = {
        item.strip().strip("'") for item in m_broad.group(2).split(',')
    }
    narrow_items = {
        item.strip().strip("'") for item in m_narrow.group(2).split(',')
    }
    if narrow_items and narrow_items.issubset(broad_items):
      return True

  # Check `percent <= 50` subsuming `percent <= 10`
  p_broad = PERCENT_LE_CLAUSE_RE.match(norm_broad)
  p_narrow = PERCENT_LE_CLAUSE_RE.match(norm_narrow)
  if p_broad and p_narrow:
    if float(p_broad.group(1)) >= float(p_narrow.group(1)):
      return True

  return False


def _condition_subsumes(
    broad_clauses: list[str], narrow_clauses: list[str]
) -> bool:
  """Returns True if every clause in broad_clauses subsumes a narrow clause."""
  if not broad_clauses or not narrow_clauses:
    return False
  for b_clause in broad_clauses:
    if not any(
        _clause_subsumes(b_clause, n_clause) for n_clause in narrow_clauses
    ):
      return False
  return True


def _validate_parameter_key(
    key: str, path: str, findings: list[Finding]
) -> None:
  """Validates parameter key format and reserved keywords."""
  if not key or len(key) > MAX_PARAMETER_NAME_LENGTH:
    findings.append(
        Finding(
            'RC001_KEY_FORMAT',
            'ERROR',
            path,
            f'Parameter key "{key}" must be 1..{MAX_PARAMETER_NAME_LENGTH} '
            'characters.',
        )
    )
  elif not PARAMETER_NAME_REGEX.match(key):
    findings.append(
        Finding(
            'RC001_KEY_FORMAT',
            'ERROR',
            path,
            f'Parameter key "{key}" does not match (^[a-zA-Z_][0-9a-zA-Z_]*$).',
        )
    )
  if key in RESERVED_JS_KEYWORDS:
    findings.append(
        Finding(
            'RC001_KEY_FORMAT',
            'ERROR',
            path,
            f'Parameter key "{key}" is a reserved JavaScript keyword.',
        )
    )


def _normalize_numeric_string(
    raw_val: str, normalize_leading_dot: bool = False
) -> str:
  """Normalizes leading '+' and scientific notation (1e2), plus leading-dot decimals when normalize_leading_dot=True."""
  s = raw_val.strip()
  if s.startswith('+'):
    s = s[1:]
  if normalize_leading_dot:
    if s.startswith('.'):
      s = '0' + s
    elif s.startswith('-.'):
      s = '-0.' + s[2:]
  if re.fullmatch(r'-?(?:\d*\.)?\d+[eE][+-]?\d+', s):
    try:
      import decimal

      d = decimal.Decimal(s)
      s = format(d, 'f')
      if '.' in s:
        s = s.rstrip('0').rstrip('.')
    except Exception:  # pylint: disable=broad-except
      pass
  return s


def _validate_datatype_string(
    raw_val: str,
    value_type: str,
    path: str,
    findings: list[Finding],
    strict_numeric: bool = False,
) -> None:
  """Validates a string value against valueType."""
  if value_type == 'BOOLEAN':
    if raw_val.lower() not in ('true', 'false'):
      findings.append(
          Finding(
              'RC006_VALUE_TYPE',
              'ERROR',
              path,
              f'PARAM_VALUE_TYPE_MISMATCH: BOOLEAN value "{raw_val}" must be '
              '"true" or "false" (case-insensitive).',
          )
      )
  elif value_type == 'NUMBER':
    num_re = STRICT_BACKEND_NUMERIC_REGEX if strict_numeric else NUMERIC_REGEX
    if not num_re.match(raw_val):
      findings.append(
          Finding(
              'RC006_VALUE_TYPE',
              'ERROR',
              path,
              f'PARAM_VALUE_TYPE_MISMATCH: NUMBER value "{raw_val}" does not '
              'match ^-?\\d+(\\.\\d+)?$ (no leading "+", no scientific '
              'notation like "1e2", and a leading digit is required before '
              'the decimal point on managed rollout/experiment parameters, '
              'e.g. "0.5", "-0.25", "100").',
          )
      )
  elif value_type == 'JSON':
    try:
      json.loads(raw_val)
    except ValueError as exc:
      findings.append(
          Finding(
              'RC006_VALUE_TYPE',
              'ERROR',
              path,
              f'PARAM_VALUE_TYPE_MISMATCH: invalid JSON string ({exc}).',
          )
      )


def _validate_value_object(
    val_obj: Any,
    value_type: str,
    is_default: bool,
    namespace: str,
    path: str,
    fix_types: bool,
    findings: list[Finding],
    strict_numeric: bool = False,
) -> None:
  """Validates ParameterValue object and value_source oneof."""
  if not isinstance(val_obj, dict):
    findings.append(
        Finding(
            'RC007_ONEOF_DEFAULT',
            'ERROR',
            path,
            'ParameterValue must be a JSON object.',
        )
    )
    return

  present_oneofs = [f for f in VALUE_ONEOF_FIELDS if f in val_obj]
  if len(present_oneofs) != 1:
    findings.append(
        Finding(
            'RC007_ONEOF_DEFAULT',
            'ERROR',
            path,
            f'ParameterValue must specify exactly one of {VALUE_ONEOF_FIELDS}; '
            f'found {present_oneofs}.',
        )
    )
    return

  active_field = present_oneofs[0]
  if active_field == 'useInAppDefault':
    if val_obj['useInAppDefault'] is not True:
      findings.append(
          Finding(
              'RC007_ONEOF_DEFAULT',
              'ERROR',
              path,
              'INVALID_IN_APP_DEFAULT_VALUE: useInAppDefault must be true '
              '(never false).',
          )
      )
    return

  if active_field in DYNAMIC_VALUE_FIELDS:
    if is_default:
      findings.append(
          Finding(
              'RC007_ONEOF_DEFAULT',
              'ERROR',
              path,
              'INVALID_DEFAULT_PARAM_VALUE: defaultValue cannot use '
              f'{active_field}.',
          )
      )
    if namespace == 'firebase-server':
      findings.append(
          Finding(
              'RC007_ONEOF_DEFAULT',
              'ERROR',
              path,
              f'UNSUPPORTED_PARAM_VALUE: {active_field} is not supported in '
              'the firebase-server namespace.',
          )
      )
    # Validate managed value payloads & arm datatypes
    managed_obj = val_obj[active_field]
    if active_field == 'rolloutValue' and isinstance(managed_obj, dict):
      # Check rollout value datatype (REST `value` or Console `enabledVariantValue.value`)
      if isinstance(managed_obj.get('value'), str):
        if fix_types and value_type == 'NUMBER':
          managed_obj['value'] = _normalize_numeric_string(
              managed_obj['value'], normalize_leading_dot=True
          )
        _validate_datatype_string(
            managed_obj['value'],
            value_type,
            f'{path}.rolloutValue.value',
            findings,
            strict_numeric=True,
        )
      enabled_var = managed_obj.get('enabledVariantValue')
      if isinstance(enabled_var, dict) and isinstance(
          enabled_var.get('value'), str
      ):
        if fix_types and value_type == 'NUMBER':
          enabled_var['value'] = _normalize_numeric_string(
              enabled_var['value'], normalize_leading_dot=True
          )
        _validate_datatype_string(
            enabled_var['value'],
            value_type,
            f'{path}.rolloutValue.enabledVariantValue.value',
            findings,
            strict_numeric=True,
        )
      # Check rollout percentage range (REST `percent` 0..100 or microPercentRange 0..50_000_000 / 100_000_000)
      if 'percent' in managed_obj:
        pct = managed_obj['percent']
        if not isinstance(pct, (int, float)) or not (0 <= float(pct) <= 100):
          findings.append(
              Finding(
                  'RC008_ROLLOUT_RANGE',
                  'ERROR',
                  f'{path}.rolloutValue.percent',
                  f'INVALID_ROLLOUT_PERCENTAGE: rollout percent ({pct}) must '
                  'be between 0 and 100.',
              )
          )
      mpr = managed_obj.get('microPercentRange')
      if not isinstance(mpr, dict):
        epc = managed_obj.get('enabledPercentCondition')
        if isinstance(epc, dict):
          mpr = epc.get('microPercentRange')
      if isinstance(mpr, dict):
        start = mpr.get(
            'microPercentLowerBound', mpr.get('microPercentStart', 0)
        )
        end = mpr.get('microPercentUpperBound', mpr.get('microPercentEnd', 0))
        if (
            not isinstance(start, (int, float))
            or not isinstance(end, (int, float))
            or start != 0
            or end <= 0
            or (
                end > MAX_PARTIAL_ROLLOUT_MICRO_PERCENT
                and end != MAX_ROLLOUT_MICRO_PERCENT
            )
        ):
          if fix_types and isinstance(end, (int, float)) and end > 0:
            if 'microPercentLowerBound' in mpr:
              mpr['microPercentLowerBound'] = 0
            else:
              mpr['microPercentStart'] = 0
            if (
                end > MAX_PARTIAL_ROLLOUT_MICRO_PERCENT
                and end != MAX_ROLLOUT_MICRO_PERCENT
            ):
              clamped = MAX_PARTIAL_ROLLOUT_MICRO_PERCENT
              if 'microPercentUpperBound' in mpr:
                mpr['microPercentUpperBound'] = clamped
              else:
                mpr['microPercentEnd'] = clamped
          else:
            findings.append(
                Finding(
                    'RC008_ROLLOUT_RANGE',
                    'ERROR',
                    f'{path}.rolloutValue.microPercentRange',
                    f'INVALID_ROLLOUT_PERCENTAGE: microPercentRange ({start}..'
                    f'{end}) must satisfy start == 0 and (0 < end <= '
                    f'{MAX_PARTIAL_ROLLOUT_MICRO_PERCENT} (50% max partial '
                    f'rollout cap) or end == {MAX_ROLLOUT_MICRO_PERCENT} '
                    '(100%)).',
                )
            )
    elif active_field == 'experimentValue' and isinstance(managed_obj, dict):
      variants = managed_obj.get('variantValue', [])
      if isinstance(variants, list):
        for v_idx, var_obj in enumerate(variants):
          if (
              isinstance(var_obj, dict)
              and not var_obj.get('noChange')
              and isinstance(var_obj.get('value'), str)
          ):
            if fix_types and value_type == 'NUMBER':
              var_obj['value'] = _normalize_numeric_string(
                  var_obj['value'], normalize_leading_dot=True
              )
            _validate_datatype_string(
                var_obj['value'],
                value_type,
                f'{path}.experimentValue.variantValue[{v_idx}].value',
                findings,
                strict_numeric=True,
            )
    return

  # Static 'value' check
  raw_val = val_obj['value']
  if not isinstance(raw_val, str):
    if fix_types:
      if isinstance(raw_val, bool):
        val_obj['value'] = 'true' if raw_val else 'false'
      elif isinstance(raw_val, (int, float)):
        val_obj['value'] = str(raw_val)
      else:
        val_obj['value'] = json.dumps(raw_val)
      raw_val = val_obj['value']
    else:
      findings.append(
          Finding(
              'RC006_VALUE_TYPE',
              'ERROR',
              f'{path}.value',
              'PARAM_VALUE_TYPE_MISMATCH: static value must be a JSON string, '
              f'got {type(raw_val).__name__}.',
          )
      )
      return

  if fix_types and value_type == 'NUMBER':
    raw_val = _normalize_numeric_string(
        raw_val, normalize_leading_dot=strict_numeric
    )
    val_obj['value'] = raw_val

  _validate_datatype_string(
      raw_val,
      value_type,
      f'{path}.value',
      findings,
      strict_numeric=strict_numeric,
  )


def _validate_targeting_clause(
    clause: str, c_path: str, findings: list[Finding]
) -> None:
  """Validates individual AND clauses in a condition expression."""
  norm = clause.strip()
  initial_finding_count = len(findings)
  if norm == 'false':
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            'ConditionCase.ALWAYS_FALSE ("false") is rejected by '
            'ConditionValidator in Remote Config; only "true" (ALWAYS_TRUE) '
            'or valid targeting signal clauses are allowed.',
        )
    )
  if norm.startswith('!'):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Negation (!) in "{clause}" is rejected; use !=, '
            'notContains, notInAtLeastOne, or inNone.',
        )
    )

  if HALLUCINATED_OS_RE.search(norm):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Invalid OS field/operator in "{clause}": use '
            "`device.os == 'ios'` (`'ios'`, `'android'`, `'web'`; `==` only "
            'in Console), not `app.operatingSystem` or `device.os !=`.',
        )
    )

  if HALLUCINATED_AUDIENCES_RE.search(norm):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Invalid audiences syntax in "{clause}": use '
            "`app.audiences.inAtLeastOne(['audience_id'])` (`inAtLeastOne` "
            'only in Console), not `in [...]`, `==`, `.notIn([...])`, '
            '`.inAll([...])`, `.notInAll([...])`, or'
            ' `.notInAtLeastOne([...])`.',
        )
    )

  if HALLUCINATED_PERCENT_FN_RE.match(norm):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Invalid percent() syntax in "{clause}": use '
            "`percent('seed') between 0 and 10` or `percent <= 10`, not "
            "`percent('seed', min, max)`.",
        )
    )

  if HALLUCINATED_VERSION_BUILD_RE.match(norm):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Invalid version/build syntax in "{clause}": use method syntax '
            "with a list argument, e.g., `app.version.>=(['2.4.0'])` or "
            "`app.version.exactlyMatches(['2.4.0'])`.",
        )
    )

  if HALLUCINATED_STRING_METHOD_RE.search(norm):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Invalid string/regex method in "{clause}": supported methods are '
            '`.exactlyMatches([...])`, `.contains([...])`, '
            '`.notContains([...])`, and `.matches([...])`; `.regex`, '
            '`.startsWith`, and `.endsWith` do not exist.',
        )
    )

  if HALLUCINATED_FIRST_OPEN_RE.search(norm):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Invalid firstOpenTimestamp syntax in "{clause}": use '
            "`app.firstOpenTimestamp > ('YYYY-MM-DDTHH:mm:ss', 'Timezone')` or "
            "`app.firstOpenTimestamp <= ('YYYY-MM-DDTHH:mm:ss')` (requires "
            '`app.` prefix, only `<=` or `>`, and parenthesized strings '
            'without `dateTime(...)`).',
        )
    )

  if HALLUCINATED_BARE_FID_RE.search(norm):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Invalid Installation ID syntax in "{clause}": use'
            " `app.firebaseInstallationId in ['...']` (requires `app.`"
            ' prefix).',
        )
    )

  # Percentage seed pattern ^[\w.-]*$, maxLength(32), and 0..100 bounds
  m_pct = PERCENT_CLAUSE_RE.match(norm)
  if m_pct:
    seed = m_pct.group(1)
    if seed is not None:
      if len(seed) > MAX_PERCENT_SEED_LENGTH or not PERCENT_SEED_REGEX.match(
          seed
      ):
        findings.append(
            Finding(
                'RC009_EXPRESSION_GRAMMAR',
                'ERROR',
                f'{c_path}.expression',
                f'Percent seed "{seed}" in "{clause}" violates '
                'seed rules (^[\\w.-]*$, max 32 chars).',
            )
        )
    if m_pct.group(3) is not None:
      upper = float(m_pct.group(3))
      if not (0 <= upper <= 100):
        findings.append(
            Finding(
                'RC009_EXPRESSION_GRAMMAR',
                'ERROR',
                f'{c_path}.expression',
                f'Percentage bound {upper} in "{clause}" must satisfy '
                '0 <= bound <= 100.',
            )
        )
    elif m_pct.group(5) is not None and m_pct.group(6) is not None:
      lower = float(m_pct.group(5))
      upper = float(m_pct.group(6))
      if not (0 <= lower <= upper <= 100):
        findings.append(
            Finding(
                'RC009_EXPRESSION_GRAMMAR',
                'ERROR',
                f'{c_path}.expression',
                f'Percentage range {lower}..{upper} in "{clause}" must '
                'satisfy 0 <= lower <= upper <= 100.',
            )
        )

  # Numeric infix regex for customSignal and userProperty
  m_num = NUMERIC_INFIX_CUSTOM_OR_USER_PROP_RE.match(norm)
  if m_num:
    rhs = m_num.group(1).strip()
    if not rhs.startswith("'"):
      if not rhs or not CUSTOM_OR_USER_PROP_NUMERIC_REGEX.match(rhs):
        findings.append(
            Finding(
                'RC009_EXPRESSION_GRAMMAR',
                'ERROR',
                f'{c_path}.expression',
                f'Numeric operand "{rhs}" in "{clause}" must match '
                '(^[-+]?[0-9]{0,20}([.][0-9]{0,10})?$).',
            )
        )

  # Semantic version regex for version(app.customSignal[...])
  m_semver = SEMVER_CUSTOM_SIGNAL_RE.match(norm)
  if m_semver:
    ver_str = m_semver.group(1)
    if not CUSTOM_SIGNAL_SEMVER_REGEX.match(ver_str):
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              f'Semantic version "{ver_str}" in "{clause}" must match '
              '(^[0-9]+(\\.[0-9]+){0,4}$).',
          )
      )

  # Numeric version/build comparison regex
  m_ver_op = APP_VERSION_OR_BUILD_NUMERIC_OP_RE.match(norm)
  if m_ver_op:
    items = [
        item.strip().strip("'")
        for item in m_ver_op.group(1).split(',')
        if item.strip()
    ]
    if len(items) != 1 or not NUMERIC_VERSION_REGEX.match(items[0]):
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              f'Numeric version/build comparison "{clause}" requires a single '
              'value matching (^\\d+([\\d.]*\\d)?$).',
          )
      )

  # Firebase Installation ID validation regex
  m_fid = FID_IN_CLAUSE_RE.match(norm)
  if m_fid:
    fids = [
        item.strip().strip("'")
        for item in m_fid.group(1).split(',')
        if item.strip()
    ]
    for fid in fids:
      if not FID_VALIDATION_REGEX.match(fid):
        findings.append(
            Finding(
                'RC009_EXPRESSION_GRAMMAR',
                'ERROR',
                f'{c_path}.expression',
                f'Firebase Installation ID "{fid}" in "{clause}" must match '
                '(^[cdef][\\w-]{9}([AEIMQUYcgkosw048]|[\\w-]{12})$).',
            )
        )

  # Country/language ISO-3166 & case-insensitive deduplication checks
  m_cl = COUNTRY_OR_LANGUAGE_IN_RE.match(norm)
  if m_cl:
    cl_field = m_cl.group(1)
    codes = [
        item.strip().strip('\'"')
        for item in m_cl.group(2).split(',')
        if item.strip()
    ]
    if cl_field == 'country' and any(c.upper() == 'UK' for c in codes):
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              f'Invalid ISO-3166 country code "UK" in "{clause}"; use "GB" '
              'for the United Kingdom.',
          )
      )
    if len(codes) != len({c.lower() for c in codes}):
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              f'Duplicate case-insensitive {cl_field} codes in "{clause}": '
              f'{codes}. Deduplicate the list.',
          )
      )

  # Regex compilation inside .matches([...])
  for m_rx in MATCHES_CLAUSE_RE.finditer(norm):
    rx_patterns = re.findall(r"'([^']*)'", m_rx.group(1))
    for pat in rx_patterns:
      try:
        re.compile(pat)
      except re.error as exc:
        findings.append(
            Finding(
                'RC009_EXPRESSION_GRAMMAR',
                'ERROR',
                f'{c_path}.expression',
                f'Invalid regular expression "{pat}" in "{clause}": {exc}. '
                'Fix the regex syntax so it compiles cleanly.',
            )
        )

  # Local dateTime format check (no embedded timezone offsets like 'Z' or '+05:30')
  for m_dt in DATETIME_ARG_RE.finditer(norm):
    ts = m_dt.group(1)
    if not LOCAL_DATETIME_REGEX.match(ts):
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              f'Timestamp "{ts}" in "{clause}" must match local format '
              'YYYY-MM-DDTHH:mm:ss without "Z" or "+HH:MM" offset (pass '
              'timezone as the optional second string argument).',
          )
      )

  # MAX_OR_CLAUSES_ALLOWED = 10 on bracketed string lists
  if 'inOne(' not in norm:
    for m_list in re.finditer(r"\[((?:'[^']*'|[^\]])+)\]", norm):
      list_items = re.findall(r"'([^']*)'", m_list.group(1))
      if len(list_items) > MAX_OR_CLAUSES_ALLOWED:
        findings.append(
            Finding(
                'RC009_EXPRESSION_GRAMMAR',
                'ERROR',
                f'{c_path}.expression',
                f'List in "{clause}" has {len(list_items)} items, exceeding '
                f'MAX_OR_CLAUSES_ALLOWED ({MAX_OR_CLAUSES_ALLOWED}).',
            )
        )

  # Negative operator check on country/language
  if COUNTRY_OR_LANGUAGE_NOT_IN_RE.search(norm):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Clause "{clause}" uses unsupported negative operator on '
            'device.country or device.language (only `in [...]` is supported).',
        )
    )

  if len(
      findings
  ) == initial_finding_count and not ALLOWLISTED_TARGETING_CLAUSE_RE.match(
      norm
  ):
    findings.append(
        Finding(
            'RC009_EXPRESSION_GRAMMAR',
            'ERROR',
            f'{c_path}.expression',
            f'Unrecognized targeting expression clause "{clause}".',
        )
    )


def _sanitize_conditions_in_place(template: dict[str, Any]) -> None:
  """Auto-repairs ALWAYS_FALSE conditions, multi-app.id clauses, unclosed regex brackets, UK->GB, and duplicate country/language codes."""
  conditions = template.get('conditions')
  if not isinstance(conditions, list):
    return

  def _all_param_dicts() -> list[dict[str, Any]]:
    res: list[dict[str, Any]] = []
    rp = template.get('parameters')
    if isinstance(rp, dict):
      res.extend(v for v in rp.values() if isinstance(v, dict))
    pg = template.get('parameterGroups')
    if isinstance(pg, dict):
      for g_obj in pg.values():
        if isinstance(g_obj, dict) and isinstance(
            g_obj.get('parameters'), dict
        ):
          res.extend(
              v for v in g_obj['parameters'].values() if isinstance(v, dict)
          )
    return res

  new_conditions: list[Any] = []
  removed_cond_names: set[str] = set()
  split_cond_map: dict[str, list[str]] = {}

  for cond in conditions:
    if not isinstance(cond, dict):
      new_conditions.append(cond)
      continue
    name = str(cond.get('name', '')).strip()
    expr = str(cond.get('expression', '')).strip()
    if not expr:
      new_conditions.append(cond)
      continue

    clauses = _split_and_clauses(expr)
    clauses = [cl for cl in clauses if cl.strip() != 'false']
    if not clauses:
      if name:
        removed_cond_names.add(name)
      continue

    fixed_clauses: list[str] = []
    for cl in clauses:
      norm = cl.strip()
      m_cl = COUNTRY_OR_LANGUAGE_IN_RE.match(norm)
      if m_cl:
        cl_field = m_cl.group(1)
        codes = [
            item.strip().strip('\'"')
            for item in m_cl.group(2).split(',')
            if item.strip()
        ]
        deduped: list[str] = []
        seen_lower: set[str] = set()
        for c in codes:
          if cl_field == 'country' and c.upper() == 'UK':
            c = 'GB'
          if c.lower() not in seen_lower:
            seen_lower.add(c.lower())
            deduped.append(c)
        quoted = ', '.join(f"'{c}'" for c in deduped)
        norm = f'device.{cl_field} in [{quoted}]'

      def _fix_matches(m: re.Match[str]) -> str:
        inner = m.group(1)

        def _fix_pat(pm: re.Match[str]) -> str:
          pat = pm.group(1)
          try:
            re.compile(pat)
            return f"'{pat}'"
          except re.error:
            diff = pat.count('[') - pat.count(']')
            if diff > 0:
              candidate = pat + (']' * diff)
              try:
                re.compile(candidate)
                return f"'{candidate}'"
              except re.error:
                pass
            return f"'{pat}'"

        fixed_inner = re.sub(r"'([^']*)'", _fix_pat, inner)
        return f'.matches([{fixed_inner}])'

      norm = MATCHES_CLAUSE_RE.sub(_fix_matches, norm)
      fixed_clauses.append(norm)

    app_id_clauses = [
        cl for cl in fixed_clauses if re.search(r'^app\.id\s*==', cl.strip())
    ]
    other_clauses = [
        cl
        for cl in fixed_clauses
        if not re.search(r'^app\.id\s*==', cl.strip())
    ]
    if len(app_id_clauses) > 1 and name:
      split_names: list[str] = []
      for idx_app, app_cl in enumerate(app_id_clauses):
        if ':ios:' in app_cl:
          suffix = 'ios'
        elif ':android:' in app_cl:
          suffix = 'android'
        elif ':web:' in app_cl:
          suffix = 'web'
        else:
          suffix = str(idx_app + 1)
        sub_name = f'{name}_{suffix}'
        if sub_name in split_names:
          sub_name = f'{name}_{idx_app + 1}'
        split_names.append(sub_name)
        sub_cond = dict(cond)
        sub_cond['name'] = sub_name
        sub_cond['expression'] = ' && '.join([app_cl] + other_clauses)
        new_conditions.append(sub_cond)
      split_cond_map[name] = split_names
    else:
      cond['expression'] = ' && '.join(fixed_clauses)
      new_conditions.append(cond)

  template['conditions'] = new_conditions
  if removed_cond_names or split_cond_map:
    for p_obj in _all_param_dicts():
      cv = p_obj.get('conditionalValues')
      if not isinstance(cv, dict):
        continue
      new_cv: dict[str, Any] = {}
      for k, v in cv.items():
        if k in removed_cond_names:
          continue
        if k in split_cond_map:
          for sub_name in split_cond_map[k]:
            new_cv[sub_name] = json.loads(json.dumps(v))
        else:
          new_cv[k] = v
      p_obj['conditionalValues'] = new_cv


def validate_and_canonicalize(
    template: dict[str, Any],
    namespace: str = 'firebase',
    fix_order: bool = False,
    fix_types: bool = False,
    prune_dangling: bool = False,
) -> list[Finding]:
  """Validates template in-place and returns all findings."""
  findings: list[Finding] = []

  if fix_order or fix_types:
    _sanitize_conditions_in_place(template)

  version_obj = template.get('version')
  if isinstance(version_obj, dict):
    v_desc = version_obj.get('description')
    if isinstance(v_desc, str) and len(v_desc) > MAX_VERSION_DESCRIPTION_LENGTH:
      findings.append(
          Finding(
              'RC001_KEY_FORMAT',
              'ERROR',
              'version.description',
              f'Version description length ({len(v_desc)}) exceeds '
              f'max length ({MAX_VERSION_DESCRIPTION_LENGTH}).',
          )
      )

  conditions = template.get('conditions', [])
  if not isinstance(conditions, list):
    findings.append(
        Finding(
            'RC003_CONDITION_NAME', 'ERROR', 'conditions', 'Must be a list.'
        )
    )
    conditions = []

  if len(conditions) > MAX_CONDITION_COUNT:
    findings.append(
        Finding(
            'RC003_CONDITION_NAME',
            'ERROR',
            'conditions',
            f'Template has {len(conditions)} conditions '
            f'(max {MAX_CONDITION_COUNT}).',
        )
    )

  condition_names: list[str] = []
  condition_index: dict[str, int] = {}
  parsed_condition_clauses: list[tuple[str, list[str]]] = []

  for idx, cond in enumerate(conditions):
    c_path = f'conditions[{idx}]'
    if not isinstance(cond, dict):
      findings.append(
          Finding('RC003_CONDITION_NAME', 'ERROR', c_path, 'Must be an object.')
      )
      continue

    raw_name = cond.get('name', '')
    if not isinstance(raw_name, str) or not raw_name.strip():
      findings.append(
          Finding(
              'RC003_CONDITION_NAME',
              'ERROR',
              f'{c_path}.name',
              'Condition name must be a non-empty, non-whitespace string.',
          )
      )
      continue

    trimmed_name = raw_name.strip()
    if raw_name != trimmed_name:
      if fix_order or fix_types:
        raw_name = trimmed_name
        cond['name'] = raw_name
      else:
        findings.append(
            Finding(
                'RC003_CONDITION_NAME',
                'ERROR',
                f'{c_path}.name',
                f'Condition name "{raw_name}" has leading or trailing spaces.',
            )
        )

    if len(
        raw_name
    ) > MAX_CONDITION_NAME_LENGTH or not CONDITION_NAME_REGEX.match(raw_name):
      findings.append(
          Finding(
              'RC003_CONDITION_NAME',
              'ERROR',
              f'{c_path}.name',
              f'Condition name "{raw_name}" violates '
              f"(^[-_0-9a-zA-Z '!%.]+$) or exceeds "
              f'{MAX_CONDITION_NAME_LENGTH} chars.',
          )
      )

    if trimmed_name in condition_index:
      findings.append(
          Finding(
              'RC003_CONDITION_NAME',
              'ERROR',
              f'{c_path}.name',
              f'Duplicate condition name "{trimmed_name}".',
          )
      )
    else:
      condition_index[trimmed_name] = len(condition_names)
      condition_names.append(trimmed_name)

    tag_color = cond.get('tagColor')
    if tag_color is not None:
      if (
          not isinstance(tag_color, str)
          or tag_color.upper() not in VALID_TAG_COLORS
      ):
        findings.append(
            Finding(
                'RC003_CONDITION_NAME',
                'ERROR',
                f'{c_path}.tagColor',
                f'Invalid tagColor "{tag_color}".',
            )
        )
      elif fix_types:
        upper_color = tag_color.upper()
        if upper_color == 'DEEPORANGE':
          upper_color = 'DEEP_ORANGE'
        cond['tagColor'] = upper_color

    expr = cond.get('expression', '')
    if not isinstance(expr, str) or not expr.strip():
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              'Condition expression must be a non-empty string.',
          )
      )
      parsed_condition_clauses.append((trimmed_name, []))
      continue

    stripped_quotes = _strip_single_quoted_strings(expr)
    if '||' in stripped_quotes:
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              'Top-level OR (||) is rejected by Console condition editor; use '
              '`in [...]` list operators or separate conditions.',
          )
      )

    clauses = _split_and_clauses(expr)
    if len(clauses) > MAX_CONDITION_ATOMS:
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              f'Condition has {len(clauses)} AND atoms (max '
              f'{MAX_CONDITION_ATOMS}).',
          )
      )

    app_id_clauses = [
        cl for cl in clauses if re.search(r'^app\.id\s*==', cl.strip())
    ]
    if len(app_id_clauses) > 1:
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              f'Condition has {len(app_id_clauses)} app.id clauses, violating '
              'RequiredNumberOfGmpAppIds.ZERO_OR_ONE (a client request only '
              'has one GMP app.id). Split into separate per-app conditions and '
              'assign each in conditionalValues.',
          )
      )

    pct_clauses = [cl for cl in clauses if PERCENT_CLAUSE_RE.match(cl.strip())]
    if len(pct_clauses) > 1:
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              f'Condition has {len(pct_clauses)} percent clauses; at most 1 '
              'percent clause is allowed per condition.',
          )
      )

    for clause in clauses:
      _validate_targeting_clause(clause, c_path, findings)

    if 'device.dateTime' in stripped_quotes:
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              'Use top-level `dateTime`, not `device.dateTime`.',
          )
      )
    if STRING_INFIX_CUSTOM_OR_USER_PROP_RE.search(expr):
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              'String comparison on app.customSignal or app.userProperty must '
              'use .exactlyMatches([...]), .contains([...]), etc., not '
              '==/!=/</<=/>/>=.',
          )
      )
    if namespace == 'firebase-server' and CLIENT_ONLY_SIGNAL_RE.search(
        stripped_quotes
    ):
      findings.append(
          Finding(
              'RC009_EXPRESSION_GRAMMAR',
              'ERROR',
              f'{c_path}.expression',
              'firebase-server templates only support `percent` and '
              '`app.customSignal` in condition expressions.',
          )
      )

    parsed_condition_clauses.append((trimmed_name, clauses))

  # Collect all parameters across root and parameterGroups
  global_keys: dict[str, str] = {}
  all_param_entries: list[tuple[str, str, dict[str, Any]]] = []
  seen_rollout_ids: dict[str, str] = {}
  seen_personalization_ids: dict[str, str] = {}
  seen_experiments: dict[str, tuple[str, Any, list[str]]] = {}

  param_groups = template.get('parameterGroups', {})
  if not isinstance(param_groups, dict):
    findings.append(
        Finding(
            'RC002_GLOBAL_UNIQUE_KEY',
            'ERROR',
            'parameterGroups',
            'parameterGroups must be an object.',
        )
    )
    param_groups = {}

  if len(param_groups) > MAX_PARAMETER_GROUP_COUNT:
    findings.append(
        Finding(
            'RC002_GLOBAL_UNIQUE_KEY',
            'ERROR',
            'parameterGroups',
            f'Template has {len(param_groups)} groups (max '
            f'{MAX_PARAMETER_GROUP_COUNT}).',
        )
    )

  for group_name, group_obj in param_groups.items():
    g_path = f'parameterGroups.{group_name}'
    if (
        not group_name
        or not group_name.strip()
        or len(group_name) > MAX_PARAMETER_GROUP_KEY_LENGTH
        or group_name != group_name.strip()
    ):
      findings.append(
          Finding(
              'RC002_GLOBAL_UNIQUE_KEY',
              'ERROR',
              g_path,
              f'Group key "{group_name}" must be'
              f' 1..{MAX_PARAMETER_GROUP_KEY_LENGTH} chars with no'
              ' leading/trailing spaces.',
          )
      )
    global_keys[group_name] = g_path
    if not isinstance(group_obj, dict):
      continue
    g_desc = group_obj.get('description')
    if (
        isinstance(g_desc, str)
        and len(g_desc) > MAX_PARAMETER_GROUP_DESCRIPTION_LENGTH
    ):
      findings.append(
          Finding(
              'RC002_GLOBAL_UNIQUE_KEY',
              'ERROR',
              f'{g_path}.description',
              f'Group description length ({len(g_desc)}) exceeds '
              f'max length ({MAX_PARAMETER_GROUP_DESCRIPTION_LENGTH}).',
          )
      )
    g_params = group_obj.get('parameters', {})
    if isinstance(g_params, dict):
      for p_key, p_obj in g_params.items():
        p_path = f'{g_path}.parameters.{p_key}'
        all_param_entries.append((p_key, p_path, p_obj))

  root_params = template.get('parameters', {})
  if isinstance(root_params, dict):
    for p_key, p_obj in root_params.items():
      p_path = f'parameters.{p_key}'
      all_param_entries.append((p_key, p_path, p_obj))

  if len(all_param_entries) > MAX_PARAMETER_COUNT:
    findings.append(
        Finding(
            'RC001_KEY_FORMAT',
            'ERROR',
            'parameters',
            f'Template has {len(all_param_entries)} total parameters '
            f'(max {MAX_PARAMETER_COUNT}).',
        )
    )

  for p_key, p_path, p_obj in all_param_entries:
    _validate_parameter_key(p_key, p_path, findings)
    if p_key in global_keys:
      findings.append(
          Finding(
              'RC002_GLOBAL_UNIQUE_KEY',
              'ERROR',
              p_path,
              f'DUPLICATE_KEY: "{p_key}" collides with {global_keys[p_key]}.',
          )
      )
    else:
      global_keys[p_key] = p_path

    if not isinstance(p_obj, dict):
      continue

    p_desc = p_obj.get('description')
    if (
        isinstance(p_desc, str)
        and len(p_desc) > MAX_PARAMETER_DESCRIPTION_LENGTH
    ):
      findings.append(
          Finding(
              'RC001_KEY_FORMAT',
              'ERROR',
              f'{p_path}.description',
              f'Parameter description length ({len(p_desc)}) exceeds '
              f'max length ({MAX_PARAMETER_DESCRIPTION_LENGTH}).',
          )
      )

    value_type = p_obj.get('valueType', 'STRING')
    if value_type not in VALID_VALUE_TYPES:
      findings.append(
          Finding(
              'RC006_VALUE_TYPE',
              'ERROR',
              f'{p_path}.valueType',
              f'Invalid valueType "{value_type}".',
          )
      )
      value_type = 'STRING'

    cond_vals = p_obj.get('conditionalValues')
    has_managed_rollout_or_exp = isinstance(cond_vals, dict) and any(
        isinstance(cv_entry, dict)
        and ('rolloutValue' in cv_entry or 'experimentValue' in cv_entry)
        for cv_entry in cond_vals.values()
    )
    if 'defaultValue' in p_obj:
      _validate_value_object(
          p_obj['defaultValue'],
          value_type,
          is_default=True,
          namespace=namespace,
          path=f'{p_path}.defaultValue',
          fix_types=(fix_types or fix_order),
          findings=findings,
          strict_numeric=has_managed_rollout_or_exp,
      )
    else:
      if not isinstance(cond_vals, dict) or not cond_vals:
        findings.append(
            Finding(
                'RC007_ONEOF_DEFAULT',
                'ERROR',
                f'{p_path}.defaultValue',
                f'Parameter "{p_key}" must specify defaultValue or '
                'non-empty conditionalValues.',
            )
        )
      elif value_type in ('BOOLEAN', 'NUMBER', 'JSON'):
        if fix_types or fix_order:
          p_obj['defaultValue'] = {'useInAppDefault': True}
        else:
          findings.append(
              Finding(
                  'RC007_ONEOF_DEFAULT',
                  'ERROR',
                  f'{p_path}.defaultValue',
                  f'MISSING_TYPED_DEFAULT_VALUE: Parameter "{p_key}" has '
                  f'valueType "{value_type}" but omits defaultValue. '
                  'ExternalProtoConverters synthesizes {"value": ""} for '
                  'omitted defaultValue, failing InternalTemplateValidator '
                  f'for {value_type}. Set "defaultValue": '
                  '{"useInAppDefault": true} (or a valid typed string).',
              )
          )

    if isinstance(cond_vals, dict):
      dangling_keys = [k for k in cond_vals if k not in condition_index]
      for d_key in dangling_keys:
        if prune_dangling:
          del cond_vals[d_key]
        else:
          findings.append(
              Finding(
                  'RC004_CONDITION_REF',
                  'ERROR',
                  f'{p_path}.conditionalValues.{d_key}',
                  f'UNKNOWN_CONDITION_REFERENCE: "{d_key}" does not exist in '
                  'top-level conditions.',
              )
          )

      valid_keys = [k for k in cond_vals if k in condition_index]
      expected_keys = sorted(valid_keys, key=lambda k: condition_index[k])
      if valid_keys != expected_keys:
        if fix_order:
          reordered = {k: cond_vals[k] for k in expected_keys}
          for k in cond_vals:
            if k not in reordered:
              reordered[k] = cond_vals[k]
          p_obj['conditionalValues'] = reordered
          cond_vals = reordered
        else:
          findings.append(
              Finding(
                  'RC005_CONDITION_ORDER',
                  'ERROR',
                  f'{p_path}.conditionalValues',
                  f'CONDITION_ORDER_MISMATCH: keys {valid_keys} do not '
                  f'match conditions weight order {expected_keys}.',
              )
          )

      p13n_keys_to_delete: list[str] = []
      for c_name, c_val_obj in list(cond_vals.items()):
        c_val_path = f'{p_path}.conditionalValues.{c_name}'
        _validate_value_object(
            c_val_obj,
            value_type,
            is_default=False,
            namespace=namespace,
            path=c_val_path,
            fix_types=(fix_types or fix_order),
            findings=findings,
            strict_numeric=has_managed_rollout_or_exp,
        )
        if isinstance(c_val_obj, dict):
          rv_obj = c_val_obj.get('rolloutValue')
          if isinstance(rv_obj, dict) and isinstance(
              rv_obj.get('rolloutId'), str
          ):
            r_id = rv_obj['rolloutId']
            if r_id in seen_rollout_ids:
              if fix_order or fix_types:
                static_val = str(rv_obj.get('value', 'true'))
                c_val_obj.clear()
                c_val_obj['value'] = static_val
              else:
                findings.append(
                    Finding(
                        'RC008_ROLLOUT_RANGE',
                        'ERROR',
                        f'{c_val_path}.rolloutValue.rolloutId',
                        f'DUPLICATE_ROLLOUT_ID: rolloutId "{r_id}" is already '
                        f'attached to {seen_rollout_ids[r_id]}. Do not copy '
                        'rolloutValue when duplicating a parameter; replace it '
                        'with static {"value": "<rolloutValue.value>"}.',
                    )
                )
            else:
              seen_rollout_ids[r_id] = c_val_path

          pv_obj = c_val_obj.get('personalizationValue')
          if isinstance(pv_obj, dict) and isinstance(
              pv_obj.get('personalizationId'), str
          ):
            p_id = pv_obj['personalizationId']
            if p_id in seen_personalization_ids:
              if fix_order or fix_types:
                p13n_keys_to_delete.append(c_name)
              else:
                findings.append(
                    Finding(
                        'RC008_ROLLOUT_RANGE',
                        'ERROR',
                        f'{c_val_path}.personalizationValue.personalizationId',
                        'DUPLICATE_PERSONALIZATION_ID: personalizationId '
                        f'"{p_id}" is already attached to '
                        f'{seen_personalization_ids[p_id]}. Do not copy '
                        'personalizationValue when duplicating a parameter.',
                    )
                )
            else:
              seen_personalization_ids[p_id] = c_val_path

          ev_obj = c_val_obj.get('experimentValue')
          if isinstance(ev_obj, dict) and isinstance(
              ev_obj.get('experimentId'), str
          ):
            e_id = ev_obj['experimentId']
            e_pct = ev_obj.get('exposurePercent')
            e_vars = [
                str(v.get('variantId'))
                for v in ev_obj.get('variantValue', [])
                if isinstance(v, dict)
            ]
            if e_id in seen_experiments:
              first_path, first_pct, first_vars = seen_experiments[e_id]
              if e_pct != first_pct or e_vars != first_vars:
                if fix_order or fix_types:
                  ev_obj['exposurePercent'] = first_pct
                  existing_by_id = {
                      str(v.get('variantId')): v
                      for v in ev_obj.get('variantValue', [])
                      if isinstance(v, dict)
                  }
                  ev_obj['variantValue'] = [
                      existing_by_id.get(
                          vid, {'variantId': vid, 'noChange': True}
                      )
                      for vid in first_vars
                  ]
                else:
                  findings.append(
                      Finding(
                          'RC008_ROLLOUT_RANGE',
                          'ERROR',
                          f'{c_val_path}.experimentValue',
                          f'EXPERIMENT_MISMATCH: experimentId "{e_id}" has'
                          f' exposurePercent={e_pct} and variantIds={e_vars},'
                          f' which does not match {first_path}'
                          f' (exposurePercent={first_pct},'
                          f' variantIds={first_vars}). Align exposurePercent'
                          ' and variantIds across all parameters in the'
                          ' experiment (use {"variantId": "0", "noChange":'
                          ' true} for control variants).',
                      )
                  )
            else:
              seen_experiments[e_id] = (c_val_path, e_pct, e_vars)
      for k_del in p13n_keys_to_delete:
        cond_vals.pop(k_del, None)

  # RC010: Condition Precedence Shadowing Check
  for i in range(len(parsed_condition_clauses)):
    broad_name, broad_clauses = parsed_condition_clauses[i]
    for j in range(i + 1, len(parsed_condition_clauses)):
      narrow_name, narrow_clauses = parsed_condition_clauses[j]
      if _condition_subsumes(broad_clauses, narrow_clauses):
        affected_params = [
            p_key
            for p_key, _, p_obj in all_param_entries
            if isinstance(p_obj, dict)
            and isinstance(p_obj.get('conditionalValues'), dict)
            and broad_name in p_obj['conditionalValues']
            and narrow_name in p_obj['conditionalValues']
        ]
        severity = 'ERROR' if affected_params else 'WARNING'
        affected_msg = (
            f' Affected parameters: {affected_params}.'
            if affected_params
            else ' (No parameter currently references both.)'
        )
        findings.append(
            Finding(
                'RC010_CONDITION_SHADOWING',
                severity,
                f'conditions[{i}] -> conditions[{j}]',
                f'Broad condition "{broad_name}" at index {i} logically '
                f'subsumes narrower condition "{narrow_name}" at index {j}, '
                f'shadowing it under first-match-wins.{affected_msg}',
            )
        )

  return findings


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(
      description='Validate and canonicalize a Firebase Remote Config template.'
  )
  parser.add_argument('template_path', help='Path to remote_config.json file.')
  parser.add_argument(
      '--namespace',
      choices=('firebase', 'firebase-server'),
      default='firebase',
      help='Target Remote Config namespace (default: firebase).',
  )
  parser.add_argument(
      '--fix-order',
      action='store_true',
      help='Sort conditionalValues keys in-place to match conditions[0..N-1].',
  )
  parser.add_argument(
      '--fix-types',
      action='store_true',
      help='Coerce raw JSON bool/number values into strings in-place.',
  )
  parser.add_argument(
      '--prune-dangling',
      action='store_true',
      help='Remove unknown condition references from conditionalValues.',
  )
  parser.add_argument(
      '--json',
      action='store_true',
      help='Output validation report as structured JSON.',
  )
  parser.add_argument(
      '--format',
      choices=('text', 'json'),
      default='text',
      help='Output format for validation report (default: text).',
  )
  parser.add_argument(
      '--strict',
      action='store_true',
      help='Treat WARNING findings as fatal errors (exit code 1).',
  )
  parser.add_argument(
      '-o',
      '--output',
      default=None,
      help='Optional output file path for canonicalized template JSON.',
  )
  args = parser.parse_args(argv)

  with open(args.template_path, 'r', encoding='utf-8') as f:
    template = json.load(f)

  findings = validate_and_canonicalize(
      template,
      namespace=args.namespace,
      fix_order=args.fix_order,
      fix_types=args.fix_types,
      prune_dangling=args.prune_dangling,
  )

  if args.output or args.fix_order or args.fix_types or args.prune_dangling:
    out_path = args.output or args.template_path
    with open(out_path, 'w', encoding='utf-8') as f:
      json.dump(template, f, indent=2)
      f.write('\n')

  errors = [item for item in findings if item.severity == 'ERROR']
  is_valid = (not findings) if args.strict else (not errors)
  if args.json or args.format == 'json':
    print(
        json.dumps(
            {
                'valid': is_valid,
                'error_count': len(errors),
                'warning_count': len(findings) - len(errors),
                'findings': [dataclasses.asdict(item) for item in findings],
            },
            indent=2,
        )
    )
  else:
    for item in findings:
      print(f'[{item.severity}] {item.rule_id} at {item.path}: {item.message}')
    if not findings:
      print('OK: Template passed all RC001-RC010 validation checks.')

  return 0 if is_valid else 1


if __name__ == '__main__':
  sys.exit(main())
