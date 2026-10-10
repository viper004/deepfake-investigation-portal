# Oracle Cloud (OCI) VM Configuration & Deployment Guide

This document provides a step-by-step walkthrough for provisioning, configuring, and deploying the **Deepfake Investigation Portal (Aurora)** on an Oracle Cloud Compute Virtual Machine (VM).

## Phase 0: Oracle VCN (Virtual Cloud Network) Creation

You can set up your VCN in Oracle Cloud Console using the **VCN Wizard** (fastest) or manually.

### Option A: Using the VCN Wizard (Recommended - 2 Minutes)
1. Log into **Oracle Cloud Console** (cloud.oracle.com).
2. Open the navigation menu and go to **Networking > Virtual Cloud Networks**.
3. Select your **Compartment** on the left menu.
4. Click **Start VCN Wizard**.
5. Select **VCN with Internet Connectivity** and click **Start VCN Wizard**.
6. Configure:
   - **VCN Name**: `aurora-vcn`
   - **Compartment**: Select your compartment.
   - **VCN IPv4 CIDR Block**: `10.0.0.0/16` (default)
   - **Public Subnet IPv4 CIDR Block**: `10.0.0.0/24` (default)
   - **Private Subnet IPv4 CIDR Block**: `10.0.1.0/24` (default)
7. Click **Next** and then **Create**.
   - *This automatically creates your VCN, Public Subnet, Internet Gateway, Route Table, and Default Security List.*

---

## Phase 1: Network & Firewall Security

### 1. Oracle Cloud VCN Security Rules (OCI Console)
In the Oracle Cloud Console, navigate to **Networking > Virtual Cloud Networks > [aurora-vcn] > Security Lists > Default Security List for aurora-vcn** and add the following **Ingress Rules**:

| Source CIDR | Protocol | Port Range | Purpose |
|---|---|---|---|
| `0.0.0.0/0` | TCP | `22` | SSH Remote Access |
| `0.0.0.0/0` | TCP | `80` | HTTP Web Traffic |
| `0.0.0.0/0` | TCP | `443` | HTTPS Secure Web Traffic |
| `0.0.0.0/0` | TCP | `3000` | Next.js Frontend Direct Port |
| `0.0.0.0/0` | TCP | `8000` | FastAPI Backend Direct Port |

### 2. Guest OS Firewall (VM Terminal)
Ubuntu instances on OCI restrict traffic by default. Run the following commands to configure `ufw`:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
sudo ufw --force enable
```

---

## Phase 2: Memory Swap Configuration (PyTorch Safety)

Preloading PyTorch models requires extra memory during backend initialization. Allocate a 4GB Swap file to prevent Out-Of-Memory (OOM) crashes:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Phase 3: System Dependencies & Database Setup

### 1. Install System Packages & Node.js
```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3, MySQL Server, Nginx, FFmpeg, Git, Build Tools
sudo apt install -y python3-pip python3-venv python3-dev mysql-server nginx ffmpeg git build-essential
```

### 2. MySQL Database Setup
Open MySQL shell:
```bash
sudo mysql
```

Execute SQL statements:
```sql
CREATE DATABASE dip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sentinel_user'@'localhost' IDENTIFIED BY 'SecurePass2026!';
GRANT ALL PRIVILEGES ON dip.* TO 'sentinel_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## Phase 4: Backend Setup (`backend/.env`)

1. Navigate to the backend folder:
```bash
cd /home/ubuntu/deepfake-investigation-portal/backend
```

2. Create virtual environment and install dependencies:
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

3. Create `backend/.env` file:
```bash
nano .env
```

4. Paste the configuration (replace `<YOUR_VM_PUBLIC_IP>` with your Oracle Instance IP):

```ini
DATABASE_URL=mysql+pymysql://sentinel_user:SecurePass2026!@localhost:3306/dip
FRONTEND_URL=http://<YOUR_VM_PUBLIC_IP>:3000
BACKEND_PUBLIC_URL=http://<YOUR_VM_PUBLIC_IP>:8000
CORS_ORIGINS=http://<YOUR_VM_PUBLIC_IP>:3000,http://<YOUR_VM_PUBLIC_IP>

# SMTP Email Configuration
SMTP_USERNAME=jagannathsyam2000@gmail.com
SMTP_PASSWORD=your_smtp_app_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_TLS=True
SMTP_SSL=False
MAIL_FROM=jagannathsyam2000@gmail.com
MAIL_FROM_NAME=Aurora Investigation Platform
```

---

## Phase 5: Frontend Setup (`frontend/.env.local`)

1. Navigate to the frontend folder:
```bash
cd /home/ubuntu/deepfake-investigation-portal/frontend
```

2. Install Node dependencies:
```bash
npm install
```

3. Create `frontend/.env.local`:
```bash
nano .env.local
```

4. Paste the configuration (replace `<YOUR_VM_PUBLIC_IP>`):

```ini
AUTH_SECRET="fL6+4K+2d7bQ9a5N8wR1xZ4yU7jC3vM9pT5kH2eL8o="
AUTH_URL="http://<YOUR_VM_PUBLIC_IP>:3000"
NEXTAUTH_URL="http://<YOUR_VM_PUBLIC_IP>:3000"
NEXT_PUBLIC_BACKEND_URL="http://<YOUR_VM_PUBLIC_IP>:8000"
```

5. Build the production application:
```bash
npm run build
```

---

## Phase 6: Systemd Background Services

### 1. Backend Service File (`/etc/systemd/system/aurora-backend.service`)
```bash
sudo nano /etc/systemd/system/aurora-backend.service
```

Paste:
```ini
[Unit]
Description=Aurora Deepfake Backend FastAPI Service
After=network.target mysql.service

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/deepfake-investigation-portal/backend
Environment="PATH=/home/ubuntu/deepfake-investigation-portal/backend/venv/bin"
ExecStart=/home/ubuntu/deepfake-investigation-portal/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 2. Frontend Service File (`/etc/systemd/system/aurora-frontend.service`)
```bash
sudo nano /etc/systemd/system/aurora-frontend.service
```

Paste:
```ini
[Unit]
Description=Aurora Deepfake Frontend Next.js Service
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/deepfake-investigation-portal/frontend
ExecStart=/usr/bin/npm start -- -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 3. Enable & Start System Services
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aurora-backend
sudo systemctl enable --now aurora-frontend
```

---

## Phase 7: Nginx Reverse Proxy Setup

1. Create Nginx site configuration:
```bash
sudo nano /etc/nginx/sites-available/aurora
```

2. Paste configuration (replace `<YOUR_VM_PUBLIC_IP>`):
```nginx
server {
    listen 80;
    server_name <YOUR_VM_PUBLIC_IP>;

    client_max_body_size 100M;

    # Next.js Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # FastAPI Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads Static Directory
    location /uploads/ {
        proxy_pass http://127.0.0.1:8000/uploads/;
        proxy_set_header Host $host;
    }
}
```

3. Enable site and reload Nginx:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/aurora /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Phase 8: Verification & Status Monitoring

Check system statuses and live logs:
```bash
# Service Statuses
sudo systemctl status aurora-backend
sudo systemctl status aurora-frontend
sudo systemctl status nginx

# Monitor Live Logs
sudo journalctl -u aurora-backend -f
sudo journalctl -u aurora-frontend -f
```
