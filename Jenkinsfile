pipeline {
    agent any

    tools {
        nodejs 'NodeJS-20'
    }

    environment {
        VERCEL_TOKEN = credentials('vercel-token')
        VERCEL_ORG_ID = credentials('vercel-org-id')
        VERCEL_PROJECT_ID = credentials('vercel-project-id')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
                dir('sales-mgmt') {
                    sh 'npm ci'
                }
            }
        }

        stage('Lint') {
            steps {
                dir('sales-mgmt') {
                    sh 'npx eslint src/ --max-warnings=0'
                }
            }
        }

        stage('Test') {
            steps {
                dir('sales-mgmt') {
                    sh 'npm test'
                }
            }
        }

        stage('Security Scan') {
            steps {
                sh 'npm run security:scan-secrets'
            }
        }

        stage('Build Frontend') {
            steps {
                dir('sales-mgmt') {
                    sh 'npm run build'
                }
            }
        }

        stage('Deploy to Vercel') {
            steps {
                sh '''
                    npm install -g vercel
                    vercel pull --yes --token=$VERCEL_TOKEN
                    vercel build --prod --token=$VERCEL_TOKEN
                    vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
                '''
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully — deployed to Vercel!'
        }
        failure {
            echo '❌ Pipeline failed — deployment blocked.'
        }
    }
}
