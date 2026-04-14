package com.sweetdata.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.sweetdata.app.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var auth: FirebaseAuth

    // New Project Constants (Hardcoded)
    private val APP_ID = "1:676123277528:android:3ebdd46817a2c69576ffad"
    private val API_KEY = "AIzaSyAr8lD08wGwjZk3Fp7BVCHyJ_T2ofERXiQ"
    private val PROJECT_ID = "sweetdata-85207"
    private val DB_URL = "https://sweetdata-85207-default-rtdb.firebaseio.com"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Explicit Initialization: Fixes the 'hanging' login
        val options = FirebaseOptions.Builder()
            .setApplicationId(APP_ID)
            .setApiKey(API_KEY)
            .setProjectId(PROJECT_ID)
            .setDatabaseUrl(DB_URL)
            .build()

        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this, options)
        }

        auth = FirebaseAuth.getInstance()

        if (auth.currentUser != null) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }

        binding.btnLogin.setOnClickListener {
            handleLogin()
        }
    }

    private fun handleLogin() {
        val email = binding.etEmail.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Fields cannot be empty", Toast.LENGTH_SHORT).show()
            return
        }

        // Login Style: Show ProgressBar
        binding.btnLogin.visibility = View.GONE
        binding.progressBar.visibility = View.VISIBLE

        auth.signInWithEmailAndPassword(email, password)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    Toast.makeText(this, "Welcome back!", Toast.LENGTH_SHORT).show()
                    startActivity(Intent(this, MainActivity::class.java))
                    finish()
                } else {
                    // Detailed Error Logging: SHA-1 or Provider issues
                    val error = task.exception?.message ?: "Unknown error"
                    Toast.makeText(this, "Login Failed: $error", Toast.LENGTH_LONG).show()
                    
                    // Try to register if login fails (User might be new)
                    registerUser(email, password)
                }
            }
    }

    private fun registerUser(email: String, password: String) {
        auth.createUserWithEmailAndPassword(email, password)
            .addOnCompleteListener { task ->
                binding.btnLogin.visibility = View.VISIBLE
                binding.progressBar.visibility = View.GONE
                
                if (task.isSuccessful) {
                    Toast.makeText(this, "Account Created!", Toast.LENGTH_SHORT).show()
                    startActivity(Intent(this, MainActivity::class.java))
                    finish()
                } else {
                    val error = task.exception?.message ?: "Unknown error"
                    Toast.makeText(this, "Registration Failed: $error", Toast.LENGTH_LONG).show()
                }
            }
    }
}
