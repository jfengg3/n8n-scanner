
"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useRef } from "react"
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  FileText,
  Upload,
  Info,
  Zap,
  Lock,
  Activity,
  Moon,
  Sun,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { WorkflowVisualization } from "@/components/workflow-visualization"
import { ReportGenerator } from "@/components/report-generator"


interface ValidationResult {
  isValid: boolean
  isN8nWorkflow: boolean
  errors: string[]
  warnings: string[]
  info: string[]
  securityIssues: SecurityIssue[]
  workflowInfo?: {
    name?: string
    nodes: number
    connections: number
    version?: string
  }
}

interface SecurityIssue {
  severity: "high" | "medium" | "low"
  type: string
  message: string
  nodeId?: string
  nodeName?: string
  description?: string
  remediation?: string
}

export default function N8nAnalyzer() {
  const [jsonInput, setJsonInput] = useState("")
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [workflowData, setWorkflowData] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const { theme, setTheme } = useTheme()
  const [isDragOver, setIsDragOver] = useState(false)

  const analyzeJson = async () => {
    if (!jsonInput.trim()) {
      setResult({
        isValid: false,
        isN8nWorkflow: false,
        errors: ["Please provide JSON input"],
        warnings: [],
        info: [],
        securityIssues: [],
      })
      return
    }

    setIsAnalyzing(true)

    try {
      const parsed = JSON.parse(jsonInput)
      setWorkflowData(parsed)
      const validation = validateN8nWorkflow(parsed)
      setResult(validation)
    } catch (error) {
      setResult({
        isValid: false,
        isN8nWorkflow: false,
        errors: [`Invalid JSON format: ${error instanceof Error ? error.message : "Unknown error"}`],
        warnings: [],
        info: [],
        securityIssues: [],
      })
      setWorkflowData(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const validateN8nWorkflow = (data: any): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []
    const info: string[] = []
    const securityIssues: SecurityIssue[] = []

    // Check if it's an n8n workflow
    const isN8nWorkflow = data && (data.nodes || data.connections || data.meta?.instanceId || data.name)

    if (!isN8nWorkflow) {
      errors.push("This doesn't appear to be an n8n workflow file")
      return {
        isValid: false,
        isN8nWorkflow: false,
        errors,
        warnings,
        info,
        securityIssues,
      }
    }

    // Validate required fields
    if (!data.nodes || !Array.isArray(data.nodes)) {
      errors.push("Missing or invalid 'nodes' array")
    }

    if (!data.connections || typeof data.connections !== "object") {
      errors.push("Missing or invalid 'connections' object")
    }

    // Validate nodes
    if (data.nodes && Array.isArray(data.nodes)) {
      data.nodes.forEach((node: any, index: number) => {
        if (!node.id) {
          errors.push(`Node at index ${index} is missing required 'id' field`)
        }
        if (!node.type) {
          errors.push(`Node '${node.name || node.id || index}' is missing required 'type' field`)
        }
        if (!node.typeVersion) {
          warnings.push(`Node '${node.name || node.id || index}' is missing 'typeVersion' field`)
        }

        // Security checks
        checkNodeSecurity(node, securityIssues)
      })
    }

    // Check workflow metadata
    if (data.meta) {
      if (data.meta.instanceId) {
        info.push(`Workflow from instance: ${data.meta.instanceId}`)
      }
      if (data.meta.templateCredsSetupCompleted) {
        info.push("Template credentials setup completed")
      }
    }

    // Count connections
    let connectionCount = 0
    if (data.connections) {
      Object.values(data.connections).forEach((nodeConnections: any) => {
        if (nodeConnections && typeof nodeConnections === "object") {
          Object.values(nodeConnections).forEach((outputs: any) => {
            if (Array.isArray(outputs)) {
              outputs.forEach((outputConnections: any) => {
                if (Array.isArray(outputConnections)) {
                  connectionCount += outputConnections.length
                }
              })
            }
          })
        }
      })
    }
    

    // Count nodes (excluding sticky notes)
    const actualNodes = data.nodes.filter((node: any) => !node.type.includes("stickyNote"))
    const workflowInfo = {
      name: data.name || "Unnamed Workflow",
      nodes: actualNodes.length,
      connections: connectionCount,
      version: data.meta?.version,
    }

    info.push(`Workflow contains ${workflowInfo.nodes} nodes and ${workflowInfo.connections} connections`)

    return {
      isValid: errors.length === 0,
      isN8nWorkflow: true,
      errors,
      warnings,
      info,
      securityIssues,
      workflowInfo,
    }
  }

  const checkNodeSecurity = (node: any, securityIssues: SecurityIssue[]) => {
    const nodeName = node.name || node.id || "Unknown"

    // Skip sticky notes from security analysis
    if (node.type.includes("stickyNote")) {
      return
    }

    // OWASP LLM-01: Prompt Injection
    if (
      node.type.includes("lmChat") ||
      node.type.includes("openai") ||
      node.type.includes("gemini") ||
      node.type.includes("anthropic")
    ) {
      if (node.parameters?.prompt || node.parameters?.message) {
        const promptContent = node.parameters.prompt || node.parameters.message || ""
        if (typeof promptContent === "string" && promptContent.includes("{{")) {
          securityIssues.push({
            severity: "high",
            type: "LLM-01: Prompt Injection",
            message:
              "Dynamic prompt construction detected. User input directly inserted into prompts can lead to prompt injection attacks.",
            description:
              "Prompt injection occurs when untrusted input is used to construct prompts, potentially allowing attackers to manipulate AI model behavior, extract sensitive information, or bypass safety measures.",
            remediation:
              "• Validate and sanitize all user inputs before including in prompts\n• Use parameterized prompts with clear boundaries\n• Implement input filtering for malicious patterns\n• Consider using prompt templates with restricted variable substitution\n• Monitor AI responses for unexpected behavior",
            nodeId: node.id,
            nodeName,
          })
        }
      }
    }

    // OWASP LLM-02: Insecure Output Handling
    if (node.type.includes("lmChat") || node.type.includes("openai") || node.type.includes("gemini")) {
      securityIssues.push({
        severity: "medium",
        type: "LLM-02: Insecure Output Handling",
        message:
          "AI model output used without validation. Unvalidated LLM outputs can contain malicious content or be used in downstream attacks.",
        description:
          "LLM outputs may contain malicious code, scripts, or instructions that could be executed by downstream systems or displayed to users without proper sanitization.",
        remediation:
          "• Validate and sanitize all LLM outputs before use\n• Implement output filtering for code, scripts, and malicious patterns\n• Use content security policies when displaying outputs\n• Log and monitor LLM outputs for anomalies\n• Implement rate limiting for LLM interactions",
        nodeId: node.id,
        nodeName,
      })
    }

    // OWASP LLM-03: Training Data Poisoning (for fine-tuning scenarios)
    if (node.parameters?.trainingData || node.parameters?.dataset) {
      securityIssues.push({
        severity: "high",
        type: "LLM-03: Training Data Poisoning",
        message:
          "Training data source detected. Untrusted training data can compromise model integrity and introduce backdoors.",
        description:
          "Training data poisoning involves injecting malicious or biased data into training datasets, potentially causing the model to produce harmful outputs or exhibit unintended behaviors.",
        remediation:
          "• Verify the integrity and source of all training data\n• Implement data validation and anomaly detection\n• Use trusted, curated datasets when possible\n• Monitor model performance for unexpected behaviors\n• Implement data provenance tracking",
        nodeId: node.id,
        nodeName,
      })
    }

    // OWASP LLM-04: Model Denial of Service
    if (node.type.includes("lmChat") || node.type.includes("openai")) {
      if (!node.parameters?.maxTokens && !node.parameters?.timeout) {
        securityIssues.push({
          severity: "medium",
          type: "LLM-04: Model Denial of Service",
          message:
            "No resource limits configured for LLM requests. This can lead to resource exhaustion and service disruption.",
          description:
            "Without proper resource limits, attackers can craft inputs that cause excessive resource consumption, leading to denial of service for legitimate users.",
          remediation:
            "• Set maximum token limits for requests and responses\n• Implement request timeouts\n• Use rate limiting per user/IP\n• Monitor resource usage and set alerts\n• Implement circuit breakers for LLM services",
          nodeId: node.id,
          nodeName,
        })
      }
    }

    // OWASP LLM-06: Sensitive Information Disclosure
    if (node.parameters) {
      const sensitivePatterns = [
        { pattern: /api[_-]?key/i, type: "API Key" },
        { pattern: /password/i, type: "Password" },
        { pattern: /secret/i, type: "Secret" },
        { pattern: /token/i, type: "Token" },
        { pattern: /private[_-]?key/i, type: "Private Key" },
        { pattern: /ssn|social.security/i, type: "SSN" },
        { pattern: /credit.card|ccn/i, type: "Credit Card" },
        { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, type: "Credit Card Number" },
      ]

      const checkForSensitiveData = (obj: any, path = "") => {
        if (typeof obj === "string") {
          sensitivePatterns.forEach(({ pattern, type }) => {
            if (pattern.test(obj)) {
              securityIssues.push({
                severity: "high",
                type: "LLM-06: Sensitive Information Disclosure",
                message: `Potential ${type} detected in node parameters. Sensitive data in prompts can be logged or exposed.`,
                description:
                  "LLM interactions may inadvertently expose sensitive information through logs, model training, or response caching. This can lead to data breaches and privacy violations.",
                remediation:
                  "• Remove all sensitive data from prompts and parameters\n• Use secure credential management systems\n• Implement data masking for sensitive fields\n• Review and sanitize all LLM inputs\n• Use environment variables for secrets",
                nodeId: node.id,
                nodeName,
              })
            }
          })
        } else if (typeof obj === "object" && obj !== null) {
          Object.entries(obj).forEach(([key, value]) => {
            checkForSensitiveData(value, path ? `${path}.${key}` : key)
          })
        }
      }

      checkForSensitiveData(node.parameters)
    }

    // OWASP LLM-07: Insecure Plugin Design
    if (node.type.includes("tool") || node.type.includes("agent")) {
      securityIssues.push({
        severity: "medium",
        type: "LLM-07: Insecure Plugin Design",
        message:
          "LLM tool/plugin usage detected. Insecure plugins can provide unauthorized access to sensitive functions.",
        description:
          "LLM plugins and tools may lack proper input validation, authorization controls, or may expose sensitive functions that can be exploited by malicious prompts.",
        remediation:
          "• Implement strict input validation for all plugin parameters\n• Use principle of least privilege for plugin permissions\n• Audit plugin code for security vulnerabilities\n• Implement proper authentication and authorization\n• Monitor plugin usage and outputs",
        nodeId: node.id,
        nodeName,
      })
    }

    // OWASP LLM-08: Excessive Agency
    if (node.type.includes("agent") || (node.parameters?.tools && Array.isArray(node.parameters.tools))) {
      const toolCount = node.parameters?.tools?.length || 0
      if (toolCount > 5) {
        securityIssues.push({
          severity: "high",
          type: "LLM-08: Excessive Agency",
          message: `Agent configured with ${toolCount} tools. Excessive permissions can lead to unintended actions and security breaches.`,
          description:
            "LLM agents with too many tools or excessive permissions can perform unintended actions, potentially causing data loss, unauthorized access, or system compromise.",
          remediation:
            "• Limit agent tools to only what's necessary\n• Implement approval workflows for sensitive actions\n• Use role-based access control\n• Monitor and log all agent actions\n• Implement safeguards and confirmation steps",
          nodeId: node.id,
          nodeName,
        })
      }
    }

    // OWASP LLM-09: Overreliance
    if (node.type.includes("lmChat") && !node.parameters?.fallback && !node.parameters?.validation) {
      securityIssues.push({
        severity: "medium",
        type: "LLM-09: Overreliance",
        message:
          "No fallback or validation mechanisms detected. Overreliance on LLM outputs without verification can lead to critical failures.",
        description:
          "Systems that rely entirely on LLM outputs without human oversight or validation mechanisms are vulnerable to model failures, hallucinations, and malicious manipulation.",
        remediation:
          "• Implement human-in-the-loop validation for critical decisions\n• Add fallback mechanisms for LLM failures\n• Use multiple models for cross-validation\n• Implement confidence scoring and thresholds\n• Regular model performance monitoring",
        nodeId: node.id,
        nodeName,
      })
    }

    // OWASP LLM-10: Model Theft
    if (node.parameters?.modelPath || node.parameters?.modelUrl) {
      securityIssues.push({
        severity: "medium",
        type: "LLM-10: Model Theft",
        message: "Custom model path/URL detected. Exposed model endpoints can lead to intellectual property theft.",
        description:
          "Unauthorized access to proprietary models can result in intellectual property theft, competitive disadvantage, and potential misuse of the model.",
        remediation:
          "• Secure model endpoints with proper authentication\n• Use API rate limiting and monitoring\n• Implement model access logging\n• Consider model encryption at rest\n• Use secure model serving infrastructure",
        nodeId: node.id,
        nodeName,
      })
    }

    // OWASP Agentic AI Security - Planning and Reasoning Vulnerabilities
    if (node.type.includes("agent") || node.type.includes("planning")) {
      securityIssues.push({
        severity: "medium",
        type: "Agentic AI: Insecure Planning",
        message:
          "AI agent planning capabilities detected. Insecure planning can lead to unintended or malicious action sequences.",
        description:
          "AI agents with planning capabilities may generate action sequences that bypass security controls, access unauthorized resources, or perform unintended operations.",
        remediation:
          "• Implement plan validation and approval workflows\n• Use constrained planning with predefined action sets\n• Monitor and log all planned actions\n• Implement plan simulation and testing\n• Use human oversight for critical plans",
        nodeId: node.id,
        nodeName,
      })
    }

    // Memory and Context Vulnerabilities
    if (node.type.includes("memory") || node.type.includes("buffer")) {
      securityIssues.push({
        severity: "medium",
        type: "Agentic AI: Memory Poisoning",
        message:
          "AI memory/buffer system detected. Compromised memory can persist malicious information across sessions.",
        description:
          "AI memory systems can be poisoned with malicious information that persists across interactions, potentially influencing future decisions and responses.",
        remediation:
          "• Implement memory validation and sanitization\n• Use memory isolation between users/sessions\n• Regular memory cleanup and rotation\n• Monitor memory contents for anomalies\n• Implement memory access controls",
        nodeId: node.id,
        nodeName,
      })
    }

    // Traditional Security Checks

    // Credential exposure
    if (node.credentials) {
      Object.keys(node.credentials).forEach((credType) => {
        if (node.credentials[credType].id) {
          securityIssues.push({
            severity: "low",
            type: "Credential Reference",
            message: `Node references credential of type '${credType}'. Ensure credentials are properly secured.`,
            description:
              "While using n8n's credential system is a security best practice, it's important to ensure credentials are properly configured and have minimal required permissions.",
            remediation:
              "• Verify credential permissions follow principle of least privilege\n• Regularly rotate credentials\n• Monitor credential usage\n• Use separate credentials for different environments\n• Implement credential access logging",
            nodeId: node.id,
            nodeName,
          })
        }
      })
    }

    // Code execution nodes
    const codeExecutionNodes = ["n8n-nodes-base.code", "n8n-nodes-base.function", "n8n-nodes-base.functionItem"]
    if (codeExecutionNodes.includes(node.type)) {
      securityIssues.push({
        severity: "high",
        type: "Code Execution Risk",
        message: "Node can execute custom code. Malicious code execution can compromise the entire system.",
        description:
          "Code execution nodes can run arbitrary JavaScript code, potentially allowing attackers to access sensitive data, modify system files, or establish persistence.",
        remediation:
          "• Review all custom code for malicious patterns\n• Use code sandboxing and isolation\n• Implement code review processes\n• Restrict available APIs and modules\n• Monitor code execution and outputs\n• Use static code analysis tools",
        nodeId: node.id,
        nodeName,
      })
    }

    // HTTP request nodes
    if (node.type === "n8n-nodes-base.httpRequest" && node.parameters?.url) {
      const url = node.parameters.url
      if (typeof url === "string" && (url.includes("http://") || url.includes("https://"))) {
        const severity = url.includes("http://") ? "high" : "medium"
        securityIssues.push({
          severity,
          type: "External HTTP Request",
          message: `Node makes HTTP requests to: ${url}. ${url.includes("http://") ? "Unencrypted HTTP connections expose data in transit." : "External requests may leak sensitive data."}`,
          description:
            "HTTP requests to external services can expose sensitive data, credentials, or workflow information. Unencrypted HTTP connections are particularly vulnerable to interception.",
          remediation:
            "• Use HTTPS for all external requests\n• Validate and sanitize request parameters\n• Implement request logging and monitoring\n• Use allowlists for external domains\n• Avoid sending sensitive data in URLs\n• Implement request timeouts and rate limiting",
          nodeId: node.id,
          nodeName,
        })
      }
    }

    // Webhook/form trigger nodes
    if (node.type.includes("trigger") || node.type.includes("webhook") || node.type.includes("form")) {
      if (node.webhookId || node.type.includes("webhook")) {
        securityIssues.push({
          severity: "medium",
          type: "Webhook Exposure",
          message: "Node exposes a webhook endpoint. Unsecured webhooks can be exploited by attackers.",
          description:
            "Webhook endpoints without proper authentication and validation can be abused to trigger unauthorized workflow executions, inject malicious data, or cause denial of service.",
          remediation:
            "• Implement webhook authentication (API keys, signatures)\n• Validate all incoming webhook data\n• Use HTTPS for webhook endpoints\n• Implement rate limiting and DDoS protection\n• Log and monitor webhook usage\n• Use webhook secret validation",
          nodeId: node.id,
          nodeName,
        })
      }
    }

    // Social media integrations
    if (node.type.includes("linkedIn") || node.type.includes("twitter") || node.type.includes("facebook")) {
      securityIssues.push({
        severity: "medium",
        type: "Social Media Integration Risk",
        message:
          "Node integrates with social media platforms. Compromised accounts can lead to reputation damage and data exposure.",
        description:
          "Social media integrations can be exploited to post malicious content, harvest personal information, or spread misinformation if proper controls are not in place.",
        remediation:
          "• Implement content approval workflows\n• Use read-only permissions when possible\n• Monitor posted content and interactions\n• Implement rate limiting for posts\n• Use separate accounts for automation\n• Regular security audits of social media permissions",
        nodeId: node.id,
        nodeName,
      })
    }

    // Database connections
    if (node.type.includes("postgres") || node.type.includes("mysql") || node.type.includes("database")) {
      securityIssues.push({
        severity: "high",
        type: "Database Security Risk",
        message:
          "Direct database access detected. Improper database queries can lead to SQL injection and data breaches.",
        description:
          "Direct database access without proper input validation and query parameterization can lead to SQL injection attacks, unauthorized data access, and data corruption.",
        remediation:
          "• Use parameterized queries and prepared statements\n• Implement input validation and sanitization\n• Use database user accounts with minimal privileges\n• Enable database query logging and monitoring\n• Implement connection encryption (SSL/TLS)\n• Regular database security audits",
        nodeId: node.id,
        nodeName,
      })
    }

    // File system operations
    if (node.type.includes("file") || node.type.includes("fs")) {
      securityIssues.push({
        severity: "medium",
        type: "File System Access Risk",
        message:
          "File system operations detected. Unrestricted file access can lead to data exposure and system compromise.",
        description:
          "File system operations without proper path validation can lead to directory traversal attacks, unauthorized file access, and potential system compromise.",
        remediation:
          "• Validate and sanitize all file paths\n• Use chroot jails or containers for isolation\n• Implement file access logging\n• Restrict file operations to specific directories\n• Use principle of least privilege for file permissions\n• Monitor file system changes",
        nodeId: node.id,
        nodeName,
      })
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const processFile = (file: File) => {
    if (!file.type.includes("json") && !file.name.endsWith(".json")) {
      setResult({
        isValid: false,
        isN8nWorkflow: false,
        errors: ["Please upload a JSON file"],
        warnings: [],
        info: [],
        securityIssues: [],
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setJsonInput(content)
      // Auto-analyze after file upload
      setTimeout(() => {
        try {
          const parsed = JSON.parse(content)
          setWorkflowData(parsed)
          const validation = validateN8nWorkflow(parsed)
          setResult(validation)
        } catch (error) {
          setResult({
            isValid: false,
            isN8nWorkflow: false,
            errors: [`Invalid JSON format: ${error instanceof Error ? error.message : "Unknown error"}`],
            warnings: [],
            info: [],
            securityIssues: [],
          })
          setWorkflowData(null)
        } finally {
          setIsAnalyzing(false)
        }
      }, 100)
    }
    reader.onerror = () => {
      setResult({
        isValid: false,
        isN8nWorkflow: false,
        errors: ["Failed to read file"],
        warnings: [],
        info: [],
        securityIssues: [],
      })
    }
    reader.readAsText(file)
  }

  // Drag and Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const jsonFile = files.find((file) => file.type.includes("json") || file.name.endsWith(".json"))

    if (jsonFile) {
      processFile(jsonFile)
    } else {
      setResult({
        isValid: false,
        isN8nWorkflow: false,
        errors: ["Please drop a JSON file"],
        warnings: [],
        info: [],
        securityIssues: [],
      })
    }
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
        return "secondary"
      default:
        return "default"
    }
  }

  const visualizationRef = useRef<HTMLDivElement>(null)

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <XCircle className="h-4 w-4" />
      case "medium":
        return <AlertTriangle className="h-4 w-4" />
      case "low":
        return <Info className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 transition-colors duration-300`}
    >
      {/* Header */}
      <div className="border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">n8n Security Analyzer</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Validate workflows and detect vulnerabilities
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="w-9 h-9 p-0"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
              <Badge
                variant="secondary"
                className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
              >
                <Activity className="h-3 w-3 mr-1" />
                Online
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Zap className="h-4 w-4" />
            Advanced Security Analysis
          </div>
          <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">Secure Your n8n Workflows</h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Upload your workflow JSON to detect security vulnerabilities, validate structure, and ensure best practices
            compliance.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 min-w-0">
          {/* Input Section */}
          <div className="space-y-6 min-w-0">
            <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  Upload Workflow
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Choose your preferred method to analyze your n8n workflow
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="paste" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800">
                    <TabsTrigger
                      value="paste"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm"
                    >
                      Paste JSON
                    </TabsTrigger>
                    <TabsTrigger
                      value="upload"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm"
                    >
                      Upload File
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="paste" className="space-y-4 mt-6">
                    <Textarea
                      placeholder="Paste your n8n workflow JSON here..."
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      className="min-h-[300px] max-h-[300px] font-mono text-sm border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20 resize-none bg-white dark:bg-slate-800 w-full max-w-full overflow-x-auto whitespace-pre-wrap break-words"
                    />
                  </TabsContent>

                  <TabsContent value="upload" className="space-y-4 mt-6">
                    <div
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors bg-slate-50/50 dark:bg-slate-800/50 ${
                        isDragOver
                          ? "border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/50"
                          : "border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Upload className="h-6 w-6 text-white" />
                      </div>
                      <Label htmlFor="file-upload" className="cursor-pointer block text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-medium text-slate-900 dark:text-slate-100">
                            Drop your file here
                          </span>
                          <p className="text-slate-500 dark:text-slate-400 mt-1">
                            or <span className="underline text-blue-600 dark:text-blue-400">click to browse</span>
                          </p>
                        </div>
                      </Label>
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Supports JSON files up to 10MB</p>
                    </div>
                    {jsonInput && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        File loaded successfully ({jsonInput.length.toLocaleString()} characters)
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <Button
                  onClick={analyzeJson}
                  disabled={isAnalyzing || !jsonInput.trim()}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Analyzing Workflow...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Analyze Security
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6 min-w-0">
            <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <Activity className="h-4 w-4 text-white" />
                  </div>
                  Analysis Results
                </CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  Security findings and validation status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!result ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">Ready to Analyze</h3>
                    <p className="text-slate-500 dark:text-slate-400">
                      Upload or paste a workflow to begin security analysis
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Overall Status */}
                    <div
                      className={`p-4 rounded-xl border-2 ${
                        result.isValid
                          ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                          : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {result.isValid ? (
                          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-5 w-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                            <XCircle className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <div>
                          <h3
                            className={`font-semibold ${result.isValid ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}`}
                          >
                            {result.isValid ? "Workflow Valid" : "Issues Detected"}
                          </h3>
                          <p
                            className={`text-sm ${result.isValid ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}
                          >
                            {result.isValid
                              ? "Structure is valid and properly formatted"
                              : "Critical issues need to be addressed"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Workflow Info */}
                    {result.workflowInfo && (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Workflow Overview
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                              {result.workflowInfo.nodes}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">Nodes</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                              {result.workflowInfo.connections}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">Connections</div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                          <strong>Name:</strong> {result.workflowInfo.name}
                        </div>
                      </div>
                    )}

                    {/* Security Issues */}
                    {result.securityIssues.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <Lock className="h-4 w-4 text-red-500" />
                          Security Issues ({result.securityIssues.length})
                        </h4>

                        {(() => {
                          // Group issues by node
                          const issuesByNode = result.securityIssues.reduce((acc: any, issue) => {
                            const nodeKey = issue.nodeName || "Unknown Node"
                            if (!acc[nodeKey]) {
                              acc[nodeKey] = []
                            }
                            acc[nodeKey].push(issue)
                            return acc
                          }, {})

                          const nodeKeys = Object.keys(issuesByNode)

                          return (
                            <Tabs defaultValue={nodeKeys[0]} className="w-full">
                              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1 h-auto bg-slate-100 dark:bg-slate-800 p-1">
                                {nodeKeys.map((nodeKey) => (
                                  <TabsTrigger
                                    key={nodeKey}
                                    value={nodeKey}
                                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-xs p-2 whitespace-nowrap overflow-hidden text-ellipsis"
                                    title={nodeKey}
                                  >
                                    {nodeKey} ({issuesByNode[nodeKey].length})
                                  </TabsTrigger>
                                ))}
                              </TabsList>

                              {nodeKeys.map((nodeKey) => (
                                <TabsContent key={nodeKey} value={nodeKey} className="mt-4">
                                  <div className="space-y-3">
                                    {issuesByNode[nodeKey].map((issue: any, index: number) => (
                                      <div
                                        key={index}
                                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 shadow-sm"
                                      >
                                        <div className="flex items-start justify-between mb-3">
                                          <div className="flex items-center gap-2">
                                            {getSeverityIcon(issue.severity)}
                                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                              {issue.type}
                                            </span>
                                          </div>
                                          <Badge variant={getSeverityColor(issue.severity) as any} className="text-xs">
                                            {issue.severity.toUpperCase()}
                                          </Badge>
                                        </div>

                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                          {issue.message}
                                        </p>

                                        {issue.description && (
                                          <div className="mb-3">
                                            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                              Description:
                                            </h5>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                              {issue.description}
                                            </p>
                                          </div>
                                        )}

                                        {issue.remediation && (
                                          <div className="mb-3">
                                            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                              Remediation:
                                            </h5>
                                            <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line bg-slate-50 dark:bg-slate-700 p-3 rounded border">
                                              {issue.remediation}
                                            </div>
                                          </div>
                                        )}

                                        <div className="text-xs text-slate-500 dark:text-slate-500 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded">
                                          Node: {issue.nodeName} ({issue.nodeId})
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </TabsContent>
                              ))}
                            </Tabs>
                          )
                        })()}
                      </div>
                    )}

                    {/* Errors */}
                    {result.errors.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          Errors ({result.errors.length})
                        </h4>
                        <div className="space-y-2">
                          {result.errors.map((error, index) => (
                            <div
                              key={index}
                              className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3"
                            >
                              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {result.warnings.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Warnings ({result.warnings.length})
                        </h4>
                        <div className="space-y-2">
                          {result.warnings.map((warning, index) => (
                            <div
                              key={index}
                              className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3"
                            >
                              <p className="text-sm text-yellow-800 dark:text-yellow-200">{warning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Workflow Visualization */}
        {workflowData && result && (
          <div className="mt-8">
           <WorkflowVisualization ref={visualizationRef} workflowData={workflowData} securityIssues={result?.securityIssues || []} />
          </div>
        )}

        {/* Report Generator */}
        {workflowData && result && (
          <div className="mt-8">
            <ReportGenerator
              key={`report-${JSON.stringify(result.workflowInfo)}-${result.securityIssues.length}`}
              result={result}
              workflowData={workflowData} visualizationRef={visualizationRef}            />
          </div>
        )}

        {/* Security Guidelines */}
        <Card className="mt-8 border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              Security Best Practices
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Follow these guidelines to keep your workflows secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-red-50 dark:bg-red-950 p-6 rounded-xl border border-red-200 dark:border-red-800">
                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center mb-4">
                  <XCircle className="h-5 w-5 text-white" />
                </div>
                <h4 className="font-semibold mb-3 text-red-900 dark:text-red-100">Critical Risks</h4>
                <ul className="text-sm space-y-2 text-red-800 dark:text-red-200">
                  <li>• Hardcoded passwords and API keys</li>
                  <li>• Unencrypted sensitive data</li>
                  <li>• Direct database credentials</li>
                  <li>• Exposed authentication tokens</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950 p-6 rounded-xl border border-yellow-200 dark:border-yellow-800">
                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center mb-4">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <h4 className="font-semibold mb-3 text-yellow-900 dark:text-yellow-100">Medium Risks</h4>
                <ul className="text-sm space-y-2 text-yellow-800 dark:text-yellow-200">
                  <li>• Custom code execution nodes</li>
                  <li>• External HTTP requests</li>
                  <li>• Suspicious shortened URLs</li>
                  <li>• Unvalidated user inputs</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-950 p-6 rounded-xl border border-green-200 dark:border-green-800">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <h4 className="font-semibold mb-3 text-green-900 dark:text-green-100">Best Practices</h4>
                <ul className="text-sm space-y-2 text-green-800 dark:text-green-200">
                  <li>• Use n8n credential system</li>
                  <li>• Enable HTTPS for all requests</li>
                  <li>• Validate external inputs</li>
                  <li>• Regular security audits</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
