# How to contribute

We'd love to accept your patches and contributions to this project.

## Before you begin

### Sign our Contributor License Agreement

Contributions to this project must be accompanied by a
[Contributor License Agreement](https://cla.developers.google.com/about) (CLA).
You (or your employer) retain the copyright to your contribution; this simply
gives us permission to use and redistribute your contributions as part of the
project.

If you or your current employer have already signed the Google CLA (even if it
was for a different project), you probably don't need to do it again.

Visit <https://cla.developers.google.com/> to see your current agreements or to
sign a new one.

### Review our community guidelines

This project follows
[Google's Open Source Community Guidelines](https://opensource.google/conduct/).

## Contribution process

### main and next branches

This repo has 2 protected branches, `main` and `next`. `main` is the default branch, and most users will use the skills here. `next` is used for development and will contain new skills and improvements that are being staged for release.

If you are making an incremental improvement to an existing skill, point your PR to the `main` branch. 

If you are adding a new skill, adding support for a new platform or making a significant change to an existing skill, point your PR to the `next` branch.

### Testing skills

To test out your skill, you can install it from a branch using the 'skills' CLI tool:

```bash
npx skills add  https://github.com/firebase/skills/tree/<branch-name>
```

We also have an automated eval pipeline set up in [firebase-tools](https://github.com/firebase/firebase-tools/tree/main/scripts/agent-evals) that is set up to pull content from this repo and run it against a set of test cases. You should add your own test cases there for your skill, both to check activation on the prompts you expect to trigger it, and to check that agents succeed on the tasks you expect it to help with. 

### Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.
