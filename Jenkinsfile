pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                // This pulls your code from GitHub automatically
                checkout scm
            }
        }
        stage('Syntax Check') {
            steps {
                echo 'Checking for syntax errors in server.js...'
                bat 'npm run build' 
            }
        }
        stage('Security Audit') {
            steps {
                echo 'Checking for vulnerabilities...'
                // This will show the vulnerabilities we saw earlier
                bat 'npm audit'
            }
        }
    }
    
    post {
        always {
            echo 'Build process completed.'
        }
        success {
            echo 'Deployment Ready!'
        }
        failure {
            echo 'Alert: Build Failed. Check the code!'
        }
    }
}
