package com.sweetdata.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.*
import com.sweetdata.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var auth: FirebaseAuth
    private lateinit var database: DatabaseReference
    private var rewardedInterstitialAd: RewardedInterstitialAd? = null
    
    // New Project Constants (Hardcoded)
    private val APP_ID = "1:676123277528:android:3ebdd46817a2c69576ffad"
    private val API_KEY = "AIzaSyAr8lD08wGwjZk3Fp7BVCHyJ_T2ofERXiQ"
    private val PROJECT_ID = "sweetdata-85207"
    private val DB_URL = "https://sweetdata-85207-default-rtdb.firebaseio.com"
    private val AD_UNIT_ID = "ca-app-pub-2344867686796379/1476405830"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Explicit Initialization: Ensures connectivity
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
        database = FirebaseDatabase.getInstance().reference

        val currentUser = auth.currentUser
        if (currentUser == null) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        loadUserData(currentUser.uid)
        loadRewardedAd()

        binding.btnWatchAd.setOnClickListener {
            showRewardedAd()
        }

        binding.btnBuyBundles.setOnClickListener {
            openWhatsApp(currentUser.uid)
        }

        binding.btnRedeemTrust.setOnClickListener {
            claimTrustPack(currentUser.uid)
        }
        
        binding.btnLogout.setOnClickListener {
            auth.signOut()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun loadUserData(uid: String) {
        database.child("users").child(uid).addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val balance = snapshot.child("balance").getValue(Double::class.java) ?: 0.0
                val adsWatched = snapshot.child("ads_watched").getValue(Int::class.java) ?: 0
                val trustClaimed = snapshot.child("trust_claimed").getValue(Boolean::class.java) ?: false

                binding.tvBalance.text = String.format("%.1f MB", balance)
                binding.progressBarTrust.progress = adsWatched
                binding.tvProgressText.text = "$adsWatched/25 Ads"

                // The 25-Ad Rule: 15MB Trust Pack is only visible after 25 ads
                if (adsWatched >= 25 && !trustClaimed) {
                    binding.btnRedeemTrust.visibility = View.VISIBLE
                } else {
                    binding.btnRedeemTrust.visibility = View.GONE
                }
            }

            override fun onCancelled(error: DatabaseError) {
                // Detailed Error Logging
                Toast.makeText(this@MainActivity, "DB Error: ${error.message}", Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun loadRewardedAd() {
        val adRequest = AdRequest.Builder().build()
        RewardedInterstitialAd.load(this, AD_UNIT_ID, adRequest, object : RewardedInterstitialAdLoadCallback() {
            override fun onAdFailedToLoad(adError: LoadAdError) {
                rewardedInterstitialAd = null
                // Toast.makeText(this@MainActivity, "Ad Load Failed: ${adError.message}", Toast.LENGTH_SHORT).show()
            }

            override fun onAdLoaded(ad: RewardedInterstitialAd) {
                rewardedInterstitialAd = ad
            }
        })
    }

    private fun showRewardedAd() {
        rewardedInterstitialAd?.let { ad ->
            ad.show(this) { rewardItem ->
                updateBalanceAfterAd(auth.currentUser?.uid ?: "")
                loadRewardedAd()
            }
        } ?: run {
            Toast.makeText(this, "Ad not ready. Please wait.", Toast.LENGTH_SHORT).show()
            loadRewardedAd()
        }
    }

    private fun updateBalanceAfterAd(uid: String) {
        val userRef = database.child("users").child(uid)
        userRef.runTransaction(object : Transaction.Handler {
            override fun doTransaction(mutableData: MutableData): Transaction.Result {
                val balance = mutableData.child("balance").getValue(Double::class.java) ?: 0.0
                val adsWatched = mutableData.child("ads_watched").getValue(Int::class.java) ?: 0
                val referredBy = mutableData.child("referredBy").getValue(String::class.java)

                mutableData.child("balance").value = balance + 0.8
                val newAdsCount = adsWatched + 1
                mutableData.child("ads_watched").value = newAdsCount

                if (newAdsCount == 25 && referredBy != null) {
                    database.child("users").child(referredBy).child("balance").runTransaction(object : Transaction.Handler {
                        override fun doTransaction(refData: MutableData): Transaction.Result {
                            val refBalance = refData.getValue(Double::class.java) ?: 0.0
                            refData.value = refBalance + 2.5
                            return Transaction.success(refData)
                        }
                        override fun onComplete(p0: DatabaseError?, p1: Boolean, p2: DataSnapshot?) {}
                    })
                }

                return Transaction.success(mutableData)
            }

            override fun onComplete(error: DatabaseError?, committed: Boolean, snapshot: DataSnapshot?) {
                if (committed) {
                    Toast.makeText(this@MainActivity, "+0.8 MB Earned!", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@MainActivity, "Transaction Failed: ${error?.message}", Toast.LENGTH_LONG).show()
                }
            }
        })
    }

    private fun claimTrustPack(uid: String) {
        val userRef = database.child("users").child(uid)
        userRef.runTransaction(object : Transaction.Handler {
            override fun doTransaction(mutableData: MutableData): Transaction.Result {
                val balance = mutableData.child("balance").getValue(Double::class.java) ?: 0.0
                mutableData.child("balance").value = balance + 15.0
                mutableData.child("trust_claimed").value = true
                return Transaction.success(mutableData)
            }

            override fun onComplete(error: DatabaseError?, committed: Boolean, snapshot: DataSnapshot?) {
                if (committed) {
                    Toast.makeText(this@MainActivity, "15MB Trust Pack Claimed!", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@MainActivity, "Claim Failed: ${error?.message}", Toast.LENGTH_LONG).show()
                }
            }
        })
    }

    private fun openWhatsApp(uid: String) {
        val message = "Hello SweetData, I want to buy bundles. My ID: $uid"
        val url = "https://wa.me/254789574046?text=${Uri.encode(message)}"
        val intent = Intent(Intent.ACTION_VIEW)
        intent.data = Uri.parse(url)
        startActivity(intent)
    }
}
