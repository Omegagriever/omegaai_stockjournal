# Production Directives Studio: Secure Cloud Run & Gemini Platform

A production-grade application architecture engineered to enforce and demonstrate the **7 Production Directives**:
1. **Agentic Threat Modeling**: 5 Threat Zones (Input Surfaces, Planning & Reasoning, Tool Execution, Memory & State, Inter-System Communication).
2. **Secure Coding Standard**: OWASP Top 10 (Web) and OWASP Top 10 for LLM Applications (LLM01-LLM10).
3. **Secure Firestore & Firebase Auth**: Zero Insecure Defaults, owner-bound isolation, server timestamp enforcement.
4. **Secret Management & Zero-Hardcoding Hygiene**: Dynamic Secret Manager integration with IAM binding.
5. **Security Reviewer Persona**: Rigorous code audits and severity-ranked remediation diffs.
6. **Functional Stability & Walkthroughs**: Exhaustive test walkthroughs and a 4-tier resilient Gemini model fallback ladder (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`).
7. **Production Cloud Run Deployment & Campaign Verification**: Automated deployment scripts with required challenge labels.

---

## 1. Prerequisites & GCP API Enablement

Before deploying to Google Cloud Run, ensure the Google Cloud SDK (`gcloud`) is installed and configured:

```bash
# Set your active GCP project
gcloud config set project YOUR_PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 2. Secret Management Setup (Zero Hardcoding)

Store sensitive keys such as the Gemini API Key in **Google Cloud Secret Manager** and bind IAM permissions to the Cloud Run service account:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Retrieve your project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

# 3. Grant the default Compute Service Account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

In your backend runtime or Cloud Run service, secrets are securely injected as environment variables or fetched dynamically using the Secret Manager client SDK:

```python
from google.cloud import secretmanager

def access_secret(secret_id: str, version_id: str = "latest") -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{PROJECT_NUMBER}/secrets/{secret_id}/versions/{version_id}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")
```

---

## 3. Database Security Configuration (`firestore.rules`)

Provision Cloud Firestore in Native mode and deploy the mathematically hardened, owner-isolated security rules:

```bash
# Provision Cloud Firestore Native database
gcloud firestore databases create --location=asia-southeast1 --type=firestore-native
```

### Deployed `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Global Safety Net: Default-Deny
    match /{document=**} {
      allow read, write: if false;
    }

    // Isolated User Documents & Interaction History
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /threat_models/{modelId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 4. Cloud Run Deployment Flow

Build and deploy the application container directly to Cloud Run:

```bash
# Deploy to Google Cloud Run with Secret Manager environment injection
gcloud run deploy production-directives-studio \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

---

## 5. Required Campaign Labeling (Verification Mandate)

Apply the mandatory verification label to your Cloud Run service to register for automated verification:

```bash
gcloud run services update production-directives-studio \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=asia-southeast1
```

To verify the label was successfully registered:

```bash
gcloud run services describe production-directives-studio \
  --region=asia-southeast1 \
  --format='value(metadata.labels)'
```

---

## 6. Architecture & Resilient Model Fallback Ladder

The backend implements the **Resilient Model Fallback Ladder** with automated error recovery:
1. **Primary**: `gemini-3.6-flash` (High performance, standard operational baseline)
2. **High-Availability Fallback**: `gemini-3.1-flash-lite` (Ultra-low latency fallback)
3. **Dynamic Alias**: `gemini-flash-latest` (Continuously updated Flash alias)
4. **Deep Reasoning Fallback**: `gemini-3.7-flash` (Advanced reasoning & contingency synthesis)

All endpoints utilize strict JSON schema deserialization, undefined-stripping, and robust transaction verification.
