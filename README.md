<h1 align="center"> G1Card </h1>
<p align="center"> A Unified, Secure, and Interoperable Ecosystem for Global Medical Record Management </p>

<p align="center">
  <img alt="Build" src="https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge">
  <img alt="Issues" src="https://img.shields.io/badge/Issues-0%20Open-blue?style=for-the-badge">
  <img alt="Contributions" src="https://img.shields.io/badge/Contributions-Welcome-orange?style=for-the-badge">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge">
</p>
<!-- 
  **Note:** These are static placeholder badges. Replace them with your project's actual badges.
  You can generate your own at https://shields.io
-->

## 📑 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack & Architecture](#-tech-stack--architecture)
- [Project Structure](#-project-structure)
- [Demo & Screenshots](#-demo--screenshots)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**G1Card** is a comprehensive, enterprise-grade unified medical record system designed to bridge the gap between healthcare providers and patients. By providing a single, standardized platform for medical data, G1Card ensures that critical health information is accessible, secure, and portable across different hospital systems and administrative jurisdictions.

> The modern healthcare landscape is fragmented. Patient data is often trapped in siloed legacy systems, leading to delayed treatments, redundant testing, and potential medical errors. For patients, managing health history across multiple providers is a manual and error-prone process. For hospitals, maintaining interoperable, secure, and compliant records is a significant technical and administrative burden.

**G1Card** solves these challenges by implementing a robust three-tier architecture that caters to **Superadmins, Hospitals, and Patients**. The platform centralizes medical record management through a glass-morphism inspired web interface, leveraging real-time notifications via Server-Sent Events (SSE) and a sophisticated audit logging system to ensure every data access is tracked and compliant. Whether it is managing hospital registrations, updating medical history, or handling emergency access requests, G1Card provides a seamless and secure digital environment for the entire healthcare lifecycle.

### Architecture Overview
The system is built on a modern **Full-Stack JavaScript/TypeScript** foundation:
*   **Frontend:** A high-performance React 19 application powered by Vite, utilizing a component-based architecture and Tailwind CSS 4 for a responsive, accessible UI.
*   **Backend:** A scalable Node.js/Express environment implementing a RESTful API to handle complex business logic, authentication (OTP-based), and data orchestration.
*   **Real-time Layer:** Integrated Server-Sent Events (SSE) for instantaneous notifications across all user roles.

---

## ✨ Key Features

### 🏛️ Administrative Excellence (Superadmin)
*   **Centralized Hospital Management:** Overlook the entire network of healthcare providers, approving or denying new hospital registrations.
*   **Request Lifecycle Management:** Handle sensitive deletion requests and hospital information update requests through a dedicated administrative pipeline.
*   **System-Wide Audit Logs:** Maintain a transparent record of all high-level system actions to ensure accountability and regulatory compliance.
*   **User & Settings Control:** Global management of user roles and system-wide configurations to maintain platform integrity.

### 🏥 Clinical Operations (Hospital & Staff)
*   **Staff Hierarchy:** Add and manage medical staff members, assigning specific roles within the hospital ecosystem.
*   **Dynamic Form Templates:** Create and manage custom medical form templates to standardize data collection across different clinical departments.
*   **Patient Onboarding & Management:** Streamlined workflows for adding patients, editing records, and viewing comprehensive health histories.
*   **Secure Access Requests:** Request permission to view or edit patient records, ensuring that data privacy is maintained while enabling clinical efficiency.
*   **Real-time Alerts:** Instant notification center for pending requests, staff updates, and administrative alerts.

### 👤 Patient Empowerment
*   **Portable Health History:** A dedicated dashboard for patients to view their complete medical timeline, including visits, diagnoses, and prescriptions.
*   **Privacy Control:** Manage profile completion and receive notifications whenever a hospital requests access to personal medical data.
*   **Secure Authentication:** Multi-factor protection via Email OTP for registration, login, and sensitive data changes.
*   **Self-Service Updates:** Update personal settings and manage notification preferences through an intuitive user interface.

### 🛡️ Core Infrastructure Features
*   **Audit Logging:** Every modification, login, and data access is logged with high granularity via a dedicated `auditLogger` utility.
*   **AI Integration:** Built-in `aiClient` utility (ready for diagnostic assistance or data summarization).
*   **Glass-morphism UI:** A modern, "Glass" notification and UI system that provides a premium user experience without sacrificing performance.
*   **Email Services:** Automated OTP delivery and system notifications via a centralized email service.

---

## 🛠️ Tech Stack & Architecture

### Verified Technical Stack

| Technology | Purpose | Why it was Chosen |
| :--- | :--- | :--- |
| **React 19** | Frontend Framework | Leverages the latest concurrent rendering features and hooks for a fluid UI. |
| **TypeScript** | Programming Language | Ensures type safety across the complex data models of medical records. |
| **Vite** | Build Tool | Provides lightning-fast development builds and optimized production bundles. |
| **Tailwind CSS 4** | Styling | Rapid UI development with modern utility-first CSS and high performance. |
| **Express** | Backend Framework | Lightweight and flexible RESTful API development for Node.js. |
| **React Router 7** | Routing | Manages complex nested routes for the three distinct dashboard types. |
| **SSE (Server-Sent Events)** | Real-time Updates | Efficient, uni-directional real-time communication for system notifications. |

---

## 📁 Project Structure

```
kshitij162005-g1card-f991899/
├── 📄 .gitignore                # Git exclusion rules
├── 📄 README.md                 # Root documentation
├── 📁 Server/                   # Backend Express application
│   ├── 📄 server.js             # Main entry point for the backend
│   ├── 📄 db.js                 # Database connection logic
│   ├── 📄 routes.js             # Centralized route definitions
│   ├── 📄 seed.js               # Database seeding scripts
│   ├── 📄 vercel.json           # Vercel deployment configuration
│   ├── 📄 .env.example          # Template for environment variables
│   ├── 📁 models/               # Data schemas and models
│   │   ├── 📄 Patient.js        # Patient data structure
│   │   ├── 📄 Hospital.js       # Hospital entity model
│   │   ├── 📄 AuditLog.js       # System activity log schema
│   │   ├── 📄 Record.js         # Medical record data model
│   │   └── 📄 Staff.js          # Hospital staff model
│   ├── 📁 routes/               # Modular API endpoints
│   │   ├── 📄 patient.js        # Patient-specific logic
│   │   ├── 📄 hospital.js       # Hospital-specific logic
│   │   └── 📄 sse.js            # Real-time event streaming
│   └── 📁 utils/                # Server-side utilities
│       ├── 📄 auditLogger.js    # Logic for recording system actions
│       ├── 📄 aiClient.js       # Integration for AI services
│       └── 📄 emailService.js   # OTP and notification delivery
├── 📁 Client/                   # Frontend React application
│   ├── 📄 index.tsx             # Frontend entry point
│   ├── 📄 App.tsx               # Main application component & routes
│   ├── 📄 vite.config.ts        # Vite build configuration
│   ├── 📁 components/           # Reusable UI elements
│   │   ├── 📄 GlassNotification.tsx # Styled real-time alerts
│   │   └── 📄 ThemeToggle.tsx   # Dark/Light mode switcher
│   ├── 📁 pages/                # Application views
│   │   ├── 📁 admin/            # Superadmin dashboard pages
│   │   ├── 📁 hospital/         # Hospital-role pages
│   │   └── 📁 patient/          # Patient-role pages
│   ├── 📁 contexts/             # Global state management
│   │   └── 📄 AuthContext.tsx   # User authentication state
│   ├── 📁 layouts/              # Page structure templates
│   │   ├── 📄 AdminLayout.tsx   # Layout for admin views
│   │   └── 📄 PatientLayout.tsx # Layout for patient views
│   └── 📁 hooks/                # Custom React hooks
│       └── 📄 useSSE.ts         # Hook for handling real-time events
```

---

## 📸 Demo & Screenshots

### 🖼️ Screenshots

<img src="https://placehold.co/800x450/2d2d4d/ffffff?text=Superadmin+Dashboard+Overview" alt="Admin Dashboard" width="100%">
<em><p align="center">The Superadmin Dashboard provides a bird's-eye view of all registered hospitals and pending system requests.</p></em>

<img src="https://placehold.co/800x450/2d2d4d/ffffff?text=Patient+Health+Timeline" alt="Patient Health History" width="100%">
<em><p align="center">Patients can access a unified timeline of their entire medical history across different healthcare providers.</p></em>

<img src="https://placehold.co/800x450/2d2d4d/ffffff?text=Hospital+Management+Interface" alt="Hospital Management" width="100%">
<em><p align="center">Hospital administrators can manage staff, patients, and custom medical form templates from a single interface.</p></em>

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**
- **TypeScript**: Knowledge of TS for frontend development

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kshitij162005/g1card.git
   cd g1card
   ```

2. **Backend Setup:**
   ```bash
   cd Server
   npm install
   cp .env.example .env
   # Update the .env file with your specific configuration
   npm start
   ```

3. **Frontend Setup:**
   ```bash
   cd ../Client
   npm install
   npm run dev
   ```

4. **Access the Application:**
   Open your browser and navigate to `http://localhost:5173` (or the port specified by Vite).

---

## 🔧 Usage

### For Healthcare Providers (Hospitals)
1. **Registration:** Navigate to the Hospital Registration page and submit your credentials.
2. **Staff Onboarding:** Use the Staff Management tab to add doctors, nurses, and administrative staff.
3. **Medical Records:** Add patients and begin creating records using the "Add Medical Record" button. You can use standard templates or create your own in the Form Templates section.

### For Patients
1. **Identity Verification:** Register using your email. You will receive an OTP to verify your identity.
2. **Dashboard:** Once logged in, you can view your profile completion status and any active medical records.
3. **Emergency Access:** Ensure your profile is updated so that authorized hospitals can access your data in critical situations.

### API Interaction
Developers can interact with the backend using standard REST patterns.
- **Base URL:** `http://localhost:5000` (default)
- **Health Check:** `GET /` - Returns the server status.
- **SSE Stream:** Connect to `GET /routes/sse` to receive real-time system notifications.

---

## 🤝 Contributing

We welcome contributions to improve G1Card! Your input helps make this project a better standard for medical interoperability.

### How to Contribute

1. **Fork the repository** - Click the 'Fork' button at the top right of this page.
2. **Create a feature branch** 
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** - Improve code, documentation, or UI components.
4. **Test thoroughly** - Ensure the frontend and backend communicate correctly.
5. **Commit your changes** - Write clear, descriptive commit messages.
   ```bash
   git commit -m 'Add: Implementation of secure medical record encryption'
   ```
6. **Push to your branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request** - Submit your changes for review.

### Development Guidelines
- ✅ Follow the existing TypeScript patterns and interface definitions.
- 📝 Document all new utility functions in the `utils/` directory.
- 🧪 Ensure the SSE logic handles reconnection gracefully.
- 🎨 Maintain the Glass-morphism design language for new components.

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for complete details.

### What this means:
- ✅ **Commercial use:** You can use this project commercially.
- ✅ **Modification:** You can modify the code for your own hospital or organization.
- ✅ **Distribution:** You can distribute this software.
- ✅ **Private use:** You can use this project privately.
- ⚠️ **Liability:** The software is provided "as is", without warranty.
- ⚠️ **Trademark:** This license does not grant trademark rights.

---

<p align="center">Made with ❤️ for a Healthier World</p>
<p align="center">
  <a href="#">⬆️ Back to Top</a>
</p>