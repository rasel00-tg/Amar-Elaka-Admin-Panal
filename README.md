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
