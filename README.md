<<<<<<< HEAD
# 🛡️ আমার এলাকা - অ্যাডমিন ড্যাশবোর্ড

এটি "আমার এলাকা" অ্যাপের সম্পূর্ণ Admin Control Panel। এটি আপনার বিদ্যমান Firebase Firestore ও Auth-এর সাথে সরাসরি কানেক্টেড।

---

## 📁 ফাইল স্ট্রাকচার

```
admin_dashboard/
├── index.html   ← মূল HTML ফাইল
├── styles.css   ← সম্পূর্ণ স্টাইলশিট
├── app.js       ← Firebase লজিক ও সব ফিচার
└── README.md    ← এই ফাইলটি
```

---

## 🚀 চালু করার উপায়

### পদ্ধতি ১: VS Code Live Server (সবচেয়ে সহজ)
1. VS Code-এ `admin_dashboard` ফোল্ডারটি খুলুন
2. `index.html` ফাইলে রাইট ক্লিক করুন
3. **"Open with Live Server"** এ ক্লিক করুন

### পদ্ধতি ২: Python HTTP Server
```bash
cd "c:\Amar Elaka\admin_dashboard"
python -m http.server 8080
```
তারপর ব্রাউজারে যান: `http://localhost:8080`

### পদ্ধতি ৩: Node.js serve
```bash
npx serve "c:\Amar Elaka\admin_dashboard"
```

---

## 🔐 অ্যাডমিন একাউন্ট সেটআপ

প্রথমবার ব্যবহারের জন্য Firebase-এ আপনার ইউজারকে **Super Admin** হিসেবে চিহ্নিত করতে হবে:

### Firebase Console → Firestore:

1. `users` collection → আপনার UID-র document খুলুন
2. নিচের field যুক্ত করুন:
   ```
   isSuperAdmin: true
   ```

অথবা নতুন `admins` collection তৈরি করুন:
- Document ID: আপনার Firebase UID
- Data:
  ```json
  {
    "email": "your@email.com",
    "role": "superAdmin",
    "permissions": ["all"],
    "expiryDate": null,
    "createdAt": <timestamp>
  }
  ```

---

## ✨ ফিচার সমূহ

| মডিউল | ফিচার |
|-------|-------|
| 📊 ড্যাশবোর্ড | রিয়েল-টাইম স্ট্যাটিস্টিক্স, সাম্প্রতিক ডাটা |
| 📢 নোটিশ | CRUD (যুক্ত/সম্পাদনা/মুছুন), অগ্রাধিকার |
| 📝 অভিযোগ | দেখা, মীমাংসিত করা, মুছে ফেলা |
| 🏪 ব্যবসা | ব্যবসার তালিকা পরিচালনা |
| 🩸 রক্তদাতা | রক্তের গ্রুপ অনুযায়ী ফিল্টার |
| 🏛️ সংগঠন | CRUD, লক্ষ্য ও উদ্দেশ্য |
| 💼 চাকরি | চাকরির পোস্ট ম্যানেজমেন্ট |
| 🕌 ইসলামিক | নামাজের সময়, দোয়া CRUD |
| 👥 ইউজার | সার্চ, ব্লক, রিসেট, ডিলিট |
| 🛡️ অ্যাডমিন | RBAC, এক্সপায়ারি ডেট, পারমিশন |

---

## 🔒 Firebase Security Rules

Firebase Console → Firestore → Rules-এ নিচের rules যুক্ত করুন:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAdmin() {
      return exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    function isSuperAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isSuperAdmin == true;
    }
    
    // Admins collection - only superAdmins can write
    match /admins/{adminId} {
      allow read: if request.auth != null && isAdmin();
      allow write: if request.auth != null && isSuperAdmin();
    }
    
    // Notices - admins can write, anyone can read
    match /notices/{noticeId} {
      allow read: if true;
      allow write: if request.auth != null && isAdmin();
    }
    
    // Users - only admins can read all, users can read/write their own
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow write: if request.auth != null && (request.auth.uid == userId || isAdmin());
    }
    
    // Other collections
    match /complaints/{id} { allow read: if true; allow write: if request.auth != null; }
    match /businesses/{id} { allow read: if true; allow write: if request.auth != null; }
    match /bloodDonors/{id} { allow read: if true; allow write: if request.auth != null; }
    match /organizations/{id} { allow read: if true; allow write: if request.auth != null && isAdmin(); }
    match /jobs/{id} { allow read: if true; allow write: if request.auth != null; }
    match /islamicContent/{id} { allow read: if true; allow write: if request.auth != null && isAdmin(); }
    match /duas/{id} { allow read: if true; allow write: if request.auth != null && isAdmin(); }
  }
}
```

---

## 📱 অ্যাপের সাথে রিয়েল-টাইম সংযোগ

এই ড্যাশবোর্ড থেকে যেকোনো পরিবর্তন করলে তা **সরাসরি আপনার Flutter অ্যাপে** রিয়েল-টাইমে দেখা যাবে কারণ উভয়ই একই Firebase Firestore ব্যবহার করছে।
=======
# 🛠 নতুন পল্লান পাড়া - এডমিন কন্ট্রোল প্যানেল (Admin Dashboard)

**নতুন পল্লান পাড়া** অ্যাপ্লিকেশনের সমস্ত কার্যক্রম নিয়ন্ত্রণ ও পরিচালনা করার জন্য এটি একটি শক্তিশালী এবং রেসপন্সিভ ওয়েব-বেসড ড্যাশবোর্ড। এটি এডমিনদেরকে রিয়েল-টাইম ডাটা ম্যানেজমেন্ট এবং কমিউনিটি সেবার পূর্ণ নিয়ন্ত্রণ প্রদান করে।

---

## 🖥 ড্যাশবোর্ড ফিচারসমূহ (Dashboard Features)

### 📊 রিয়েল-টাইম ওভারভিউ
- **অ্যাডমিন প্রোফাইল কার্ড:** নাম, পদবি এবং জয়েনিং তারিখ সহ একটি প্রিমিয়াম এনিমেটেড প্রোফাইল কার্ড।
- **লাইভ স্ট্যাটিস্টিকস:** মোট নিবন্ধিত ইউজার, একটিভ রক্তদাতা, অভিযোগ এবং হারানো বিজ্ঞপ্তির লাইভ সংখ্যা।
- **সাম্প্রতিক ইউজার:** সর্বশেষ ১০ জন ইউজারের নাম (Display Name), ইমেইল এবং জয়েনিং তারিখের তালিকা।

### 📢 নোটিশ ও কমিউনিকেশন
- **স্মার্ট নোটিশ পাবলিশ:** টাইটেল, বিস্তারিত বর্ণনা এবং মেয়াদকাল (Expiry Date) সহ নোটিশ প্রকাশের সুবিধা।
- **পুশ নোটিফিকেশন:** এক ক্লিকে সব ইউজারের ফোনে তাৎক্ষণিক নোটিফিকেশন পাঠানোর ব্যবস্থা।

### 🛠 ম্যানেজমেন্ট সেকশন
- **সংগঠন ব্যবস্থাপনা:** পদবি ভিত্তিক (যেমন: সভাপতি, সম্পাদক) সদস্য তালিকা যোগ ও আপডেট।
- **জরুরি সেবা:** জরুরি ফোন বুক এবং কন্টাক্ট লিস্ট পরিচালনা।
- **অভিযোগ ও হারানো বিজ্ঞপ্তি:** ইউজারদের জমা দেওয়া তথ্য যাচাই ও সমাধান।
- **চাকরি ও ব্যবসা:** স্থানীয় চাকরির পোস্ট এবং ব্যবসায়িক তালিকার অনুমোদন ও নিয়ন্ত্রণ।

### 🔐 সিকিউরিটি ও কন্ট্রোল
- **লগআউট কনফার্মেশন:** ভুলবশত লগআউট রোধে আধুনিক পপআপ সিস্টেম।
- **এডমিন এক্সেস:** একাধিক এডমিন লেভেল এবং তথ্য হালনাগাদ করার সময়সীমা নির্ধারণ।

---

## 🛠 টেকনিক্যাল স্পেসিফিকেশন (Technical Stack)

- **Framework:** Flutter Web/Mobile-friendly Responsive UI.
- **Database:** Firebase Cloud Firestore (Real-time Sync).
- **Authentication:** Firebase Auth (Admin Security Layer).
- **Icons & Fonts:** Custom Bengali Typography & Premium Material Icons.

---

## 🚀 এডমিন প্যানেল ব্যবহারের নিয়ম

১. এডমিন ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।
২. হোমপেজ থেকে এলাকার বর্তমান অবস্থা (ইউজার সংখ্যা, রক্তদাতা) পর্যবেক্ষণ করুন।
৩. মেনুবার থেকে প্রয়োজনীয় সেকশনে (যেমন: নোটিশ, সংগঠন) গিয়ে তথ্য আপডেট করুন।
৪. কাজ শেষ হলে টপবারের লগআউট আইকন ব্যবহার করে নিরাপদভাবে প্রস্থান করুন।

---

## 📜 গোপনীয়তা নীতিমালা
এই এডমিন প্যানেলে এলাকার নাগরিকদের ব্যক্তিগত তথ্য (যেমন: ফোন নম্বর, ইমেইল) সংরক্ষিত থাকে। তাই এর এক্সেস কোড বা লগইন ডিটেইলস অত্যন্ত গোপনীয় এবং শুধুমাত্র অনুমোদিত ব্যক্তিদের জন্য প্রযোজ্য।

---

**ডেভেলপমেন্ট বাই:** [রাশেদ]  
**ভার্সন:** ২.০.০ (রেসপন্সিভ ও এনিমেটেড আপডেট)
>>>>>>> 91f9712325e25feb04839466aa9f0c86b5777502
