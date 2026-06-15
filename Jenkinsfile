// Jenkins pipeline: run backend + frontend tests with coverage, then SonarQube.
//
// Prerequisites on the Jenkins controller/agent:
//   - Docker + `docker compose` available to the agent (for Postgres/Redis)
//   - Python 3.12 and Node 20 on PATH
//   - SonarQube server registered in Jenkins as 'SonarQube'
//     (Manage Jenkins > System > SonarQube servers), with its auth token
//   - A Sonar Scanner tool installation named 'SonarScanner'
//     (Manage Jenkins > Tools > SonarQube Scanner)
//
// GitHub Actions remains the required PR gate; this pipeline adds the
// SonarQube quality analysis (coverage + static analysis).

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    ENVIRONMENT       = 'test'
    DATABASE_URL      = 'postgresql+asyncpg://pantrie:pantrie@localhost:5432/pantrie_test'
    TEST_DATABASE_URL = 'postgresql+asyncpg://pantrie:pantrie@localhost:5432/pantrie_test'
    REDIS_URL         = 'redis://localhost:6379/1'
  }

  stages {
    stage('Start services') {
      steps {
        sh 'docker compose -f infrastructure/docker-compose.yml up -d postgres redis'
        sh '''
          PG=$(docker ps -qf name=postgres)
          for i in $(seq 1 30); do
            docker exec "$PG" pg_isready -U pantrie && break
            sleep 2
          done
          docker exec "$PG" psql -U pantrie -d pantrie -c "CREATE DATABASE pantrie_test;" || true
        '''
      }
    }

    stage('Backend tests + coverage') {
      steps {
        sh '''
          cd backend
          python3.12 -m venv .venv
          . .venv/bin/activate
          pip install --upgrade pip
          pip install -r requirements-dev.txt
          # pyproject addopts already emit coverage.xml (Cobertura) for Sonar
          pytest tests/
        '''
      }
    }

    stage('Frontend tests + coverage') {
      steps {
        sh '''
          cd frontend
          npm ci
          npm run test:coverage   # emits coverage/lcov.info
        '''
      }
    }

    stage('SonarQube analysis') {
      steps {
        script {
          def scannerHome = tool 'SonarScanner'
          withSonarQubeEnv('SonarQube') {
            sh "${scannerHome}/bin/sonar-scanner"
          }
        }
      }
    }

    stage('Quality Gate') {
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }
  }

  post {
    always {
      sh 'docker compose -f infrastructure/docker-compose.yml down || true'
    }
  }
}
