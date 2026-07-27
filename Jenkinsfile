// Jenkins pipeline (Kubernetes agents): backend + frontend tests with coverage,
// then SonarQube analysis. Runs each step in a purpose-built container inside a
// single agent pod; Postgres and Redis run as sidecars on shared localhost.
//
// Prerequisites (configured once in Jenkins):
//   - Kubernetes plugin (this repo's agents are K8s pods)
//   - SonarQube Scanner for Jenkins plugin, with a server named 'SonarQube'
//     pointing at the in-cluster URL (e.g. http://sonarqube-public.sonarqube:9000)
//     and a Sonar token credential. NOTE: prefer the http :9000 service URL over
//     https :443 to avoid TLS hostname-mismatch on the internal cert.
//   - For the quality gate: a SonarQube webhook -> https://<jenkins>/sonarqube-webhook/
//
// The scan runs via `npx @sonar/scan` in the node:20 container rather than the
// sonarsource/sonar-scanner-cli image: SonarQube's JS/TS analyzer needs a glibc
// Node 20+ for its bridge to start, and the scanner-cli image is Alpine/musl
// Node 18. @sonar/scan auto-provisions a JRE + scanner engine from the SonarQube
// server (over :9000, allowed by the jenkins-egress NetworkPolicy).
//
// GitHub Actions remains the required PR gate; this adds SonarQube analysis.

def podYaml = '''
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: python
      image: python:3.12
      command: ["sleep"]
      args: ["infinity"]
    - name: node
      image: node:20
      command: ["sleep"]
      args: ["infinity"]
    - name: postgres
      image: postgres:16-alpine
      env:
        - { name: POSTGRES_USER, value: pantrie }
        - { name: POSTGRES_PASSWORD, value: pantrie }
        - { name: POSTGRES_DB, value: pantrie_test }
    - name: redis
      image: redis:7-alpine
'''

pipeline {
  agent {
    kubernetes {
      yaml podYaml
      defaultContainer 'python'
    }
  }

  options {
    // timestamps() omitted — needs the Timestamper plugin (not installed)
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    ENVIRONMENT       = 'test'
    DATABASE_URL      = 'postgresql+asyncpg://pantrie:pantrie@localhost:5432/pantrie_test'
    TEST_DATABASE_URL = 'postgresql+asyncpg://pantrie:pantrie@localhost:5432/pantrie_test'
    REDIS_URL         = 'redis://localhost:6379/1'
  }

  stages {
    stage('Backend tests + coverage') {
      steps {
        container('python') {
          sh '''
            cd backend
            python -m venv .venv && . .venv/bin/activate
            pip install --upgrade pip
            pip install -r requirements-dev.txt
            # Wait for the postgres sidecar (shared localhost) to accept connections.
            python - <<'PY'
import socket, time
for _ in range(60):
    try:
        socket.create_connection(("localhost", 5432), 1).close(); break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("postgres not ready")
PY
            pytest tests/   # pyproject addopts emit coverage.xml (Cobertura)
          '''
        }
      }
    }

    stage('Frontend tests + coverage') {
      steps {
        container('node') {
          sh '''
            cd frontend
            npm ci
            npm run test:coverage   # emits coverage/lcov.info
          '''
        }
      }
    }

    // Analysis and the gate check live in ONE stage because they retry together.
    //
    // Every build -- main, branch and PR -- analyses into the single `pantrie`
    // project: isolating them with sonar.branch.name requires Developer Edition
    // and this server is Community Build (verified: the scanner rejects the
    // property outright). So two builds that submit in the same second collide,
    // and SonarQube fails the compute-engine task for the loser with
    //
    //   Date of analysis cannot be older than the date of the last known
    //   analysis on this project. It's only possible to rebuild the past in
    //   chronological order.
    //
    // That is a scheduling collision, not a quality problem -- it red-ed main
    // build 20 while a branch build scanned alongside it. Re-scanning gets a
    // fresh timestamp and succeeds.
    //
    // A lock() around the stage would be the cleaner fix, but the Lockable
    // Resources plugin is not installed on this controller. If it is ever added,
    // prefer wrapping this stage in lock('sonar-pantrie') and dropping retry().
    stage('SonarQube analysis + Quality Gate') {
      steps {
        script {
          def qualityGate = null

          // Only the collision path retries. waitForQualityGate throws when the
          // compute-engine task itself fails, which is what we want to re-run;
          // with abortPipeline:false a genuine ERROR gate returns normally
          // instead, so it falls through to the check below and fails fast
          // rather than paying for a second full scan.
          retry(2) {
            container('node') {
              withSonarQubeEnv('SonarQube') {
                // @sonar/scan reads sonar-project.properties (repo root) and the
                // SONARQUBE_SCANNER_PARAMS / SONAR_HOST_URL + SONAR_TOKEN that
                // withSonarQubeEnv injects. Runs on glibc Node 20 so the JS/TS
                // analyzer bridge starts; report-task.txt lands in .scannerwork
                // for the gate check.
                sh 'npx --yes @sonar/scan'
              }
            }
            // Requires the SonarQube -> Jenkins webhook.
            timeout(time: 5, unit: 'MINUTES') {
              qualityGate = waitForQualityGate abortPipeline: false
            }
          }

          if (qualityGate?.status != 'OK') {
            error "Quality gate failed: ${qualityGate?.status ?: 'no status returned'}"
          }
        }
      }
    }
  }
}
