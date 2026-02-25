pipeline {
    agent any
    stages {
        stage('Fetch Code') {
            steps {
                // Pointing specifically to your Mess repository
                git 'https://github.com/anoopsinghrru/rrumess'
            }
        }
        stage('Install Dependencies') {
            steps {
                echo 'Installing packages for RRUMess...'
                bat 'npm install'
            }
        }
        stage('Quality Check') {
            steps {
                echo 'Checking Node.js syntax...'
                // Ensure your server.js or index.js is named correctly here
                bat 'node --check server.js' 
            }
        }
    }
}
