#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function evaluateRules(rulesContent) {
    let score = 5;

    // Check for wildcards allow-alls (e.g., allow read, write: if true;)
    if (/allow\s+[^:]+:\s*if\s+true\s*;/.test(rulesContent)) {
        score -= 3;
    }

    // Check for unauthenticated write permissions
    if (/allow\s+write:\s*if\s+request\.auth\s*==\s*null/.test(rulesContent)) {
        score -= 2;
    }

    return score;
}

function main() {
    let inputBuffer = '';

    // Read the JSON payload from the AG harness via stdin
    process.stdin.on('data', chunk => { inputBuffer += chunk; });

    process.stdin.on('end', () => {
        let payload;
        try {
            payload = JSON.parse(inputBuffer);
        } catch (e) {
            // Safe fallback: Allow execution if stdin can't be parsed
            console.log(JSON.stringify({ decision: 'allow' }));
            process.exit(0);
        }

        const toolCall = payload.toolCall || {};
        const cmdLine = (toolCall.args || {}).CommandLine || '';
        const cwd = (toolCall.args || {}).Cwd || process.cwd();

        // Intercept Firestore deployments
        if (cmdLine.includes('firebase deploy') && cmdLine.includes('firestore')) {
            const rulesPath = path.join(cwd, 'firestore.rules');

            if (fs.existsSync(rulesPath)) {
                const rulesContent = fs.readFileSync(rulesPath, 'utf8');
                const score = evaluateRules(rulesContent);
                const threshold = 4;

                if (score < threshold) {
                    const response = {
                        decision: 'deny',
                        reason: `🚨 HOOK EXECUTED: Deployment blocked due to insecure rules! Score: ${score}/5 (Required: ${threshold}+) 🚨`
                    };
                    console.log(JSON.stringify(response));
                    process.exit(0);
                }
            }
        }

        console.log(JSON.stringify({ decision: 'allow' }));
    });
}

main();
