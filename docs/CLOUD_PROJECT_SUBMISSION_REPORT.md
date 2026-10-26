# Cloud Computing Mini Project — Final Submission Report
## Project Title: SAHAYA.AI — Cloud-Native Intelligent Learning & Career Platform

---

## 1. Executive Summary & Project Abstract

**SAHAYA.AI** is a cloud-native, multi-tier web application built to assist students in personalized academic study and career preparation. The platform provides automated study material analysis, AI-backed resume ATS scanning, adaptive quiz assessments, and individualized career roadmaps.

To meet the strict enterprise cloud engineering standards required for this project, SAHAYA.AI was migrated from a local prototype to an **AWS Cloud Infrastructure** spanning **10 AWS services across all 6 core cloud domains** (Compute, Networking, Database, Storage, Security/IAM, and Monitoring & Cost Governance).

The architecture strictly avoids high-cost pitfalls (such as NAT Gateways and Multi-AZ databases) while achieving a **$0.00 / 100% Free-Tier compliant** deployment with end-to-end security, least-privilege access, and automated incident alerting.

---

## 2. Cloud Architecture Diagram

```mermaid
flowchart TB
    subgraph Public_Internet["Public Internet"]
        Student["Student Browser (React UI)"]
        Admin["DevOps / Student Engineer"]
    end

    subgraph AWS_Cloud["AWS Cloud Region: us-east-1 (N. Virginia)"]
        subgraph Cost_Governance["Cost & Budget Governance"]
            Budget["AWS Budgets\nLimit: $2.00/mo (Alert at $1.60)"]
        end

        subgraph Identity_Layer["Identity & Access Management"]
            Cognito["Amazon Cognito User Pool\nID: us-east-1_EE6qnKupa\nClient: 4b2v1q288blr77t2dmdc3nhats"]
            IAM["IAM Instance Profile\nRole: sahaya-ec2-role\n(S3, SSM, CloudWatch policies)"]
        end

        subgraph Custom_VPC["Custom Amazon VPC: sahaya-vpc (10.0.0.0/16)"]
            IGW["Internet Gateway: sahaya-igw"]

            subgraph Public_Tier["Public Subnet: sahaya-public-subnet-1 (10.0.1.0/24 - us-east-1a)"]
                direction TB
                EC2["Amazon EC2: sahaya-web-server\nInstance: t3.micro | OS: Ubuntu 24.04\nPublic IP: 44.211.53.41\nRuntime: Node.js 20 & PM2"]
                EC2_SG["Security Group: sahaya-ec2-sg\nInbound: Port 80, 443, 22, 5000\nOutbound: 0.0.0.0/0"]
            end

            subgraph Private_Tier["Private Subnets: sahaya-private-subnet-1 & 2 (10.0.10.0/24 & 10.0.20.0/24)"]
                direction TB
                RDS[("Amazon RDS PostgreSQL: sahaya-db\nClass: db.t4g.micro (Single-AZ)\nDB: sahaya_db | Port: 5432\nPublicly Accessible: NO")]
                RDS_SG["Security Group: sahaya-rds-sg\nInbound: Port 5432 ONLY from sahaya-ec2-sg\nOutbound: None (Isolated)"]
            end
        end

        subgraph Managed_Cloud_Services["AWS Managed Services"]
            S3["Amazon S3 Bucket\nsahaya-storage-omkar-2026\n(Resumes & Study PDFs)"]
            SSM["AWS SSM Parameter Store\n/sahaya/prod/*\n(DB_HOST, DB_PASSWORD, JWT_SECRET)"]
            CW["Amazon CloudWatch\nAlarm: EC2-High-CPU-Utilization-Alert\nCondition: CPU > 75% for 1 min"]
            Lambda["AWS Lambda Function\nsahaya-doc-processor\nRuntime: Node.js 20.x"]
            SNS["Amazon SNS Topic\nsahaya-system-alerts\n(Email Protocol Subscription)"]
        end
    end

    %% Network & Request Flows
    Student -->|1. Authenticate & Obtain JWT| Cognito
    Student -->|2. HTTP / REST API (Port 5000)| IGW
    IGW -->|Route Table 0.0.0.0/0| EC2
    EC2 -->|3. Query / Persist (Port 5432)| RDS

    %% Security & Storage Flows
    EC2 -.->|Assumes Role via IMDSv2| IAM
    EC2 -->|Fetch Secrets on Boot| SSM
    EC2 -->|Upload Student Resume/PDF| S3

    %% Event-Driven Serverless Flows
    S3 -.->|s3:ObjectCreated Trigger| Lambda
    Lambda -->|Publish Document Ready Alert| SNS

    %% Monitoring & Alarms
    EC2 -->|Metrics & Logs| CW
    CW -->|Threshold Breach (>75%)| SNS
    Budget -->|Budget Warning Alert| SNS
    SNS -->|Email Notification| Admin
```

---

## 3. Services Inventory & Cloud Domains

The architecture spans **10 AWS Services** across **all 6 fundamental cloud domains**:

| # | AWS Service | Cloud Category | Exact Role in SAHAYA.AI | Free-Tier Status |
|---|---|---|---|---|
| **1** | **Amazon VPC** | Networking | Custom isolated network (`10.0.0.0/16`) with 2 Public Subnets, 2 Private Subnets, Route Tables, and Security Groups. | 100% Free |
| **2** | **Amazon EC2** | Compute (Core) | Core non-serverless compute running the Node.js/Express backend 24/7 with PM2 process manager on `t3.micro`. | 750 hrs/month Free |
| **3** | **Amazon RDS (PostgreSQL)** | Database | Managed relational database (`db.t4g.micro`, Single-AZ) in private subnets, holding user profiles, roadmaps, and quiz history. | 750 hrs/month Free |
| **4** | **Amazon S3** | Storage | Scalable cloud storage bucket (`sahaya-storage-omkar-2026`) for uploaded student resumes (PDFs) and study materials. | 5 GB Free |
| **5** | **AWS Systems Manager (SSM) Parameter Store** | Security & Config | Decoupled secrets management storing DB host, password, and JWT keys under `/sahaya/prod/*` (Zero hardcoded keys). | 100% Free (Standard) |
| **6** | **Amazon CloudWatch** | Monitoring & Observability | Collects application metrics and server health; triggers an automated Metric Alarm when EC2 CPU exceeds 75%. | 10 Metrics + 3 Alarms Free |
| **7** | **Amazon Cognito** *(Capability #1)* | Identity & Authentication | Cloud user directory (`sahaya-web-app`) managing student registration, login, and cryptographically verified JWT tokens. | 50,000 MAUs/month Free |
| **8** | **Amazon SNS** *(Capability #2)* | Messaging & Notifications | Centralized notification broker sending email alerts to DevOps on CloudWatch alarms and to students upon resume processing. | 1,000,000 pushes/month Free |
| **9** | **AWS Lambda** *(Capability #3)* | Serverless Supporting Compute | Event-driven background function (`sahaya-doc-processor`) triggered by S3 uploads to extract document metadata asynchronously. | 1,000,000 requests/month Free |
| **10** | **AWS Budgets** | Cost Governance | Proactive cloud spending guardrail configured with a $2.00/month threshold with automated email triggers. | 2 Free Budgets |

---

## 4. Faculty Condition Compliance Matrix

| # | Faculty Condition / Rule | Implementation in SAHAYA.AI | Verification Status |
|---|---|---|:---:|
| **1** | Working cloud app with Frontend, Backend, Database | React Frontend + Node.js/Express Backend + Amazon RDS PostgreSQL | ✅ **PASSED** |
| **2** | Backend must run on EC2 (No completely serverless architecture) | Runs 24/7 on EC2 instance `i-02086110b8e7580fc` managed by PM2 | ✅ **PASSED** |
| **3** | Custom VPC with subnets, route tables, IGW, and Security Groups | `sahaya-vpc` (`10.0.0.0/16`), 2 public subnets, 2 private subnets, IGW, 2 SGs | ✅ **PASSED** |
| **4** | Managed database (Amazon RDS) | `sahaya-db` (`db.t4g.micro`, PostgreSQL v16, Single-AZ) | ✅ **PASSED** |
| **5** | S3 for genuine application storage requirement | `sahaya-storage-omkar-2026` stores uploaded resumes for ATS AI Scanner | ✅ **PASSED** |
| **6** | IAM roles with least-privilege (No hardcoded credentials) | `sahaya-ec2-role` attached to EC2 via Instance Profile (Zero keys in code) | ✅ **PASSED** |
| **7** | Sensitive config in Systems Manager Parameter Store | Credentials fetched from `/sahaya/prod/*` on boot via AWS SDK v3 | ✅ **PASSED** |
| **8** | CloudWatch monitoring + at least one meaningful alarm | `EC2-High-CPU-Utilization-Alert` configured on EC2 CPU > 75% | ✅ **PASSED** |
| **9** | Cloud budget/cost alert configured | `sahaya-free-tier-budget` configured at $2.00 threshold | ✅ **PASSED** |
| **10** | Integrate at least 5 Cloud Services | **10 Services integrated** (VPC, EC2, RDS, S3, SSM, CW, Cognito, Lambda, SNS, Budgets) | ✅ **PASSED** |
| **11** | Implement at least two additional cloud capabilities | **3 Capabilities implemented:** Cognito (Auth), Lambda (Serverless), SNS (Messaging) | ✅ **PASSED** |
| **12** | Lambda used only as supporting component | Lambda processes S3 events asynchronously; does not replace EC2 backend | ✅ **PASSED** |
| **13** | Genuine functional purpose for every service (No dummy services) | Verified in data flow — every single service performs an active application task | ✅ **PASSED** |
| **14** | No basic CRUD, simple file storage, or single EC2 webpage | Comprehensive AI study companion, ATS scanner, code runner, and roadmap portal | ✅ **PASSED** |
| **15** | Demonstrate at least 5 cloud areas | Demonstrates **all 6 cloud areas** (Compute, Network, DB, Storage, Security, Monitoring) | ✅ **PASSED** |
| **16** | Avoid expensive services (NAT Gateway, Multi-AZ RDS, large instances) | **Zero NAT Gateways**, Single-AZ RDS, Free Tier `t3.micro`, $0.00 actual cost | ✅ **PASSED** |

---

## 5. Security Architecture & Least Privilege

1. **Network Layer Isolation (Defense-in-Depth):**
   * The Amazon RDS database has **`Publicly Accessible: No`** and contains no public IP.
   * `sahaya-rds-sg` only permits inbound traffic on port `5432` if the source is the `sahaya-ec2-sg` security group. Outside attackers cannot connect to the database.
2. **Credential Management (Zero Hardcoded Secrets):**
   * The application code contains zero AWS Access Keys, Secret Keys, or database passwords.
   * Database credentials and JWT secrets are stored in **AWS SSM Parameter Store** as `SecureString` types encrypted with AWS KMS.
3. **IAM Instance Profile:**
   * The EC2 instance assumes `sahaya-ec2-role` via the AWS Instance Metadata Service (IMDSv2).
   * Permissions are strictly scoped to S3 bucket read/write, SSM parameter retrieval, and CloudWatch log publishing.
4. **Identity Provider (Amazon Cognito):**
   * Password hashing, salting, session revocation, and JWT token issuance are delegated to Amazon Cognito, preventing plaintext credential theft.

---

## 6. Cost Analysis & Free-Tier Optimization ($0.00 Spent)

| Resource | Configuration | AWS Monthly Pricing | Our Free-Tier Cost |
|---|---|---|:---:|
| **NAT Gateway** | **Omitted** (Used Public Subnet + IGW for EC2) | $32.40 / month | **$0.00** |
| **EC2 Instance** | 1 x `t3.micro` Ubuntu 24.04 (750 hours) | $7.45 / month | **$0.00** (Free Tier) |
| **Amazon RDS** | 1 x `db.t4g.micro` PostgreSQL Single-AZ (750 hrs) | $13.50 / month | **$0.00** (Free Tier) |
| **Amazon S3** | 1 Bucket (Standard storage < 5 GB) | $0.023 / GB | **$0.00** (Free Tier) |
| **SSM Parameter Store** | 4 Standard Parameters | $0.00 | **$0.00** (Free Tier) |
| **Amazon Cognito** | 1 User Pool (< 50,000 MAUs) | $0.0055 / MAU | **$0.00** (Free Tier) |
| **AWS Lambda** | Event-driven invocations (< 1M calls) | $0.20 / 1M calls | **$0.00** (Free Tier) |
| **Amazon SNS** | Email notifications (< 1,000 pushes) | $0.50 / 100k calls | **$0.00** (Free Tier) |
| **Amazon CloudWatch** | 1 Custom Alarm + basic metrics (< 10 metrics) | $0.10 / alarm | **$0.00** (Free Tier) |
| **AWS Budgets** | 1 Cost Budget ($2.00 threshold) | First 2 budgets free | **$0.00** (Free Tier) |
| **TOTAL ESTIMATED MONTHLY SPEND** | | | **$0.00** |

---

## 7. Step-by-Step Live Demonstration Guide (For Viva / Faculty Evaluation)

1. **Demonstrating the Live Web Server:**
   * Open browser to: `http://44.211.53.41:5000/api/health`
   * Explain: *"The EC2 instance is active in our custom VPC. The health endpoint validates that AWS SSM, RDS PostgreSQL, S3, and Cognito are loaded."*
2. **Demonstrating Custom VPC Isolation:**
   * Open AWS Console ➔ VPC ➔ `sahaya-vpc` ➔ Resource Map.
   * Point out that Public Subnets route through `sahaya-igw`, while Private Subnets have local routes only.
3. **Demonstrating Zero Hardcoded Secrets (SSM):**
   * Show terminal logs on EC2: `[AWS SSM] Successfully fetched 4 parameters from /sahaya/prod/`.
   * Explain: *"No database password or JWT secret exists in our code or GitHub repository; everything is retrieved at runtime from Systems Manager."*
4. **Demonstrating Cloud Database (RDS):**
   * Open AWS Console ➔ RDS ➔ `sahaya-db`.
   * Highlight `Publicly Accessible: No` and show the inbound rule chaining to `sahaya-ec2-sg`.
5. **Demonstrating Event-Driven Serverless (S3 & Lambda):**
   * Upload a sample document to `sahaya-storage-omkar-2026`.
   * Show `sahaya-doc-processor` in AWS Lambda CloudWatch logs executing automatically.
6. **Demonstrating Monitoring & Alarms (CloudWatch & SNS):**
   * Open CloudWatch ➔ Alarms ➔ `EC2-High-CPU-Utilization-Alert`.
   * Show state `OK` and the notification action configured to `sahaya-system-alerts`.

---

## 8. Viva & Interview Defense Cheat-Sheet (Top 10 Questions)

#### Q1: Why didn't you use a NAT Gateway for your private subnets?
> **Answer:** *"A managed AWS NAT Gateway incurs a fixed hourly charge of approximately $0.045/hr (~$32.40/month), which is excluded from the AWS Free Tier. Because our database in the private subnet only receives internal queries from our backend and does not initiate outbound internet connections, a NAT Gateway was unnecessary. By hosting the backend in the public subnet with an Internet Gateway and keeping the database in private subnets, we achieved enterprise-grade network security while maintaining zero cost."*

#### Q2: How does EC2 connect to S3 and SSM without hardcoded access keys?
> **Answer:** *"We attached an IAM Instance Profile (`sahaya-ec2-role`) to the EC2 instance. The AWS SDK running inside Node.js queries the AWS Instance Metadata Service (IMDSv2) at `169.254.169.254` to automatically fetch short-lived, rotating security credentials. This enforces least-privilege security and 12-factor app architecture."*

#### Q3: Why didn't you use AWS Secrets Manager instead of SSM Parameter Store?
> **Answer:** *"AWS Secrets Manager costs $0.40 per secret per month, whereas AWS Systems Manager Parameter Store Standard tier is completely free for up to 10,000 parameters and supports SecureString encryption via AWS KMS."*

#### Q4: Why is your application not completely serverless?
> **Answer:** *"Our faculty guidelines strictly forbade a completely serverless architecture to ensure students understand core virtualized cloud compute (EC2), operating system management, daemon processes (PM2/systemd), and custom networking (VPCs, route tables, CIDR blocks). Serverless (Lambda) is utilized exclusively as a decoupled event-driven background processor."*

#### Q5: How do Security Groups differ from Network Access Control Lists (NACLs)?
> **Answer:** *"Security Groups operate at the instance/ENI level and are stateful — return traffic is automatically allowed regardless of inbound rules. NACLs operate at the subnet level and are stateless — both inbound and outbound rules must be explicitly configured."*

#### Q6: Why does your RDS Subnet Group require at least two Availability Zones?
> **Answer:** *"Even for Single-AZ RDS deployments, AWS requires the DB Subnet Group to span at least two Availability Zones. This enforces high-availability readiness so that if an administrator switches to Multi-AZ failover in the future, the network infrastructure is already provisioned."*

#### Q7: What is the purpose of PM2 on the EC2 instance?
> **Answer:** *"PM2 is an enterprise production process manager for Node.js. It runs the backend as a background daemon, monitors process crashes and automatically restarts the application, and links to systemd so the backend boots automatically upon server restart."*

#### Q8: How does Amazon Cognito secure authentication?
> **Answer:** *"Cognito manages user registration and password hashing using SRP (Secure Remote Password) protocol. Upon successful authentication, it returns an RS256-signed JWT (ID and Access token) containing claims that our Express backend verifies against Cognito's JSON Web Key Set (JWKS)."*

#### Q9: What happens when the CloudWatch Alarm triggers?
> **Answer:** *"If EC2 CPU utilization exceeds 75% for one evaluation period (1 minute), CloudWatch transitions the alarm state from OK to ALARM. It executes the configured action by publishing an alert to the Amazon SNS topic `sahaya-system-alerts`, which immediately delivers an incident email to the DevOps administrator."*

#### Q10: How did you ensure you don't exceed Free Tier limits?
> **Answer:** *"We used Free-Tier eligible instance classes (`t3.micro` for EC2, `db.t4g.micro` for RDS), Single-AZ deployment, 20GB gp3 storage, standard S3 tier, standard SSM parameters, and configured an active AWS Budget alert at $2.00 to alert us at 80% ($1.60) before any unexpected charges occur."*
