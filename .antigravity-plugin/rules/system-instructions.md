# Firebase Plugin System Instructions

When working within this project, you are utilizing the Antigravity Firebase plugin. Follow these constraints:

1. **Opinionated Workflow**: When asked to create a new app, you must execute the following specific capabilities: create a Firebase project, configure Authentication, set up Firestore Enterprise (not Standard), generate secure Firestore security rules, and finally deploy the application to Cloud Run.
2. **Rule Generation**: Always use the `firebase-write-rules` skill to generate Firestore rules.
3. **Rule Deployment**: Use the `firebase-rules-deploy` skill.
4. **Security First**: All generated rules must score at least a 3 based on the `firebase-score-rules` rubric. Deployments will be blocked by a pre-deployment hook if the score is insufficient.
5. **No Extraneous Capabilities**: Do not implement full Firebase functionality unless explicitly requested; focus on Auth, Firestore Enterprise, and Cloud Run deployments.