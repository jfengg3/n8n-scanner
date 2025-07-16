
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Download, Eye, Info, Activity } from "lucide-react"
import html2canvas from "html2canvas-pro"

interface SecurityIssue {
  severity: "high" | "medium" | "low"
  type: string
  message: string
  description?: string
  remediation?: string
  nodeId?: string
  nodeName?: string
}

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

interface ReportGeneratorProps {
  result: ValidationResult
  workflowData: any
  visualizationRef: React.RefObject<HTMLDivElement | null>
}

export function ReportGenerator({ result, workflowData, visualizationRef }: ReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportUrl, setReportUrl] = useState<string | null>(null)

  // Reset report when new data is analyzed
  useEffect(() => {
    setReportUrl(null)
  }, [result, workflowData])

   // Calculate secure nodes (nodes with 0 security issues)
  const calculateSecureNodes = () => {
    if (!workflowData?.nodes || !result.securityIssues) return 0

    // Get all actual nodes (excluding sticky notes)
    const actualNodes = workflowData.nodes.filter((node: any) => !node.type.includes("stickyNote"))

    // Get unique node IDs that have security issues
    const nodesWithIssues = new Set(result.securityIssues.map((issue) => issue.nodeId).filter(Boolean))

    // Count nodes that don't have any security issues
    const secureNodes = actualNodes.filter((node: any) => !nodesWithIssues.has(node.id))

    return secureNodes.length
  }

  const generateReport = async () => {
    setIsGenerating(true)

    try {
      
      let screenshotDataUrl: string | null = null

        if (visualizationRef.current) {
            const canvas = await html2canvas(visualizationRef.current)
            screenshotDataUrl = canvas.toDataURL("image/png")
        }

        const reportHtml = generateReportHTML(result, workflowData, screenshotDataUrl)

      const blob = new Blob([reportHtml], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      setReportUrl(url)
    } catch (error) {
      console.error("Error generating report:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  

  const downloadReport = () => {
    if (reportUrl) {
      const link = document.createElement("a")
      link.href = reportUrl
      link.download = `n8n-security-report-${result.workflowInfo?.name || "workflow"}-${new Date().toISOString().split("T")[0]}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const viewReport = () => {
    if (reportUrl) {
      window.open(reportUrl, "_blank")
    }
  }

  const generateReportHTML = (result: ValidationResult, workflowData: any, screenshotDataUrl: string | null): string => {
    const timestamp = new Date().toLocaleString()
    const highIssues = result.securityIssues.filter((i) => i.severity === "high").length
    const mediumIssues = result.securityIssues.filter((i) => i.severity === "medium").length
    const lowIssues = result.securityIssues.filter((i) => i.severity === "low").length

    // Calculate secure nodes properly
    const actualNodes = workflowData?.nodes
      ? workflowData.nodes.filter((node: any) => !node.type.includes("stickyNote"))
      : []
    const nodesWithIssues = new Set(result.securityIssues.map((issue) => issue.nodeId).filter(Boolean))
    const secureNodesCount = actualNodes.filter((node: any) => !nodesWithIssues.has(node.id)).length

    // Group issues by node
    const issuesByNode = result.securityIssues.reduce((acc: any, issue) => {
      const nodeKey = issue.nodeName || "Unknown Node"
      if (!acc[nodeKey]) {
        acc[nodeKey] = []
      }
      acc[nodeKey].push(issue)
      return acc
    }, {})

    // Generate workflow visualization data
    const nodeTypes = workflowData?.nodes
      ? [
          ...new Set(
            workflowData.nodes
              .filter((node: any) => !node.type.includes("stickyNote")) // Exclude sticky notes
              .map((node: any) => {
                // Extract readable node type name
                const nodeType = node.type || "Unknown"
                if (nodeType.includes(".")) {
                  const parts = nodeType.split(".")
                  return parts[parts.length - 1] // Get the last part (e.g., "httpRequest" from "n8n-nodes-base.httpRequest")
                }
                return nodeType
              })
              .filter(Boolean), // Remove any empty values
          ),
        ]
      : []

    // Get node categories for better overview
    const nodeCategories = workflowData?.nodes
      ? workflowData.nodes
          .filter((node: any) => !node.type.includes("stickyNote"))
          .reduce((acc: any, node: any) => {
            const nodeType = node.type || "unknown"
            let category = "Other"

            if (nodeType.includes("trigger") || nodeType.includes("webhook")) category = "Triggers"
            else if (nodeType.includes("lmChat") || nodeType.includes("openai") || nodeType.includes("gemini"))
              category = "AI/LLM"
            else if (nodeType.includes("http") || nodeType.includes("api")) category = "HTTP/API"
            else if (nodeType.includes("database") || nodeType.includes("postgres") || nodeType.includes("mysql"))
              category = "Database"
            else if (nodeType.includes("code") || nodeType.includes("function")) category = "Code Execution"
            else if (nodeType.includes("email") || nodeType.includes("gmail")) category = "Communication"
            else if (nodeType.includes("schedule") || nodeType.includes("cron")) category = "Scheduling"
            else if (nodeType.includes("set") || nodeType.includes("edit")) category = "Data Processing"

            acc[category] = (acc[category] || 0) + 1
            return acc
          }, {})
      : {}

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>n8n Security Analysis Report - ${result.workflowInfo?.name || "Workflow"}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8fafc;
        }
        
        .header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 2rem 0;
            text-align: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .section {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }
        
        .section h2 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .scan-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
        }
        
        .detail-item {
            background: #f8fafc;
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        
        .detail-label {
            font-weight: 600;
            color: #64748b;
            font-size: 0.875rem;
            margin-bottom: 0.25rem;
        }
        
        .detail-value {
            font-size: 1rem;
            color: #1e293b;
            font-weight: 500;
        }
        
        .security-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .risk-card {
            text-align: center;
            padding: 1.5rem;
            border-radius: 12px;
            border: 2px solid;
        }
        
        .risk-high {
            background: #fef2f2;
            border-color: #fecaca;
            color: #991b1b;
        }
        
        .risk-medium {
            background: #fffbeb;
            border-color: #fed7aa;
            color: #92400e;
        }
        
        .risk-low {
            background: #eff6ff;
            border-color: #bfdbfe;
            color: #1d4ed8;
        }
        
        .risk-safe {
            background: #f0fdf4;
            border-color: #bbf7d0;
            color: #166534;
        }
        
        .risk-number {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        
        .risk-label {
            font-weight: 600;
            margin-bottom: 0.25rem;
        }
        
        .risk-description {
            font-size: 0.875rem;
            opacity: 0.8;
        }

        .workflow-overview {
            background: #f8fafc;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
        }
        
        .node-categories {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .category-item {
            background: white;
            padding: 1rem;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            text-align: center;
        }
        
        .category-count {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1e293b;
        }
        
        .category-label {
            font-size: 0.875rem;
            color: #64748b;
            margin-top: 0.25rem;
        }
        
        .issue-node {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            overflow: hidden;
        }
        
        .node-header {
            background: #1e293b;
            color: white;
            padding: 1rem;
            font-weight: 600;
        }
        
        .issue-item {
            padding: 1.5rem;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .issue-item:last-child {
            border-bottom: none;
        }
        
        .issue-header {
            display: flex;
            justify-content: between;
            align-items: flex-start;
            margin-bottom: 1rem;
            gap: 1rem;
        }
        
        .issue-title {
            font-weight: 600;
            color: #1e293b;
            flex: 1;
        }
        
        .severity-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .severity-high {
            background: #fecaca;
            color: #991b1b;
        }
        
        .severity-medium {
            background: #fed7aa;
            color: #92400e;
        }
        
        .severity-low {
            background: #bfdbfe;
            color: #1d4ed8;
        }
        
        .issue-message {
            color: #64748b;
            margin-bottom: 1rem;
        }
        
        .issue-description {
            background: #f1f5f9;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            border-left: 4px solid #3b82f6;
        }
        
        .issue-remediation {
            background: #f0fdf4;
            padding: 1rem;
            border-radius: 6px;
            border-left: 4px solid #10b981;
            white-space: pre-line;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            font-size: 0.875rem;
        }
        
        .workflow-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: #f8fafc;
            border-radius: 8px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 4px;
        }
        
        .recommendations {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 1.5rem;
        }
        
        .recommendations h3 {
            color: #166534;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .recommendations ul {
            list-style: none;
            padding: 0;
        }
        
        .recommendations li {
            padding: 0.5rem 0;
            padding-left: 1.5rem;
            position: relative;
        }
        
        .recommendations li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #10b981;
            font-weight: bold;
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            margin-top: 2rem;
        }
        
        @media print {
            body { background: white; }
            .section { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            🛡️ n8n Security Analysis Report
        </h1>
        <p>Comprehensive Security Assessment for n8n Workflows</p>
    </div>
    
    <div class="container">
        <!-- Scan Details -->
        <div class="section">
            <h2>📋 Scan Details</h2>
            <div class="scan-details">
                <div class="detail-item">
                    <div class="detail-label">Workflow Name</div>
                    <div class="detail-value">${result.workflowInfo?.name || "Unnamed Workflow"}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Scan Timestamp</div>
                    <div class="detail-value">${timestamp}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Workflow Platform</div>
                    <div class="detail-value">n8n</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Total Nodes</div>
                    <div class="detail-value">${result.workflowInfo?.nodes || 0}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Total Connections</div>
                    <div class="detail-value">${result.workflowInfo?.connections || 0}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Workflow Status</div>
                    <div class="detail-value">${result.isValid ? "✅ Valid" : "❌ Invalid"}</div>
                </div>
            </div>
        </div>
        
        <!-- Security Summary -->
        <div class="section">
            <h2>🔍 Security Assessment Summary</h2>
            <div class="security-summary">
                <div class="risk-card risk-high">
                    <div class="risk-number">${highIssues}</div>
                    <div class="risk-label">High Risk</div>
                    <div class="risk-description">Immediate attention required</div>
                </div>
                <div class="risk-card risk-medium">
                    <div class="risk-number">${mediumIssues}</div>
                    <div class="risk-label">Medium Risk</div>
                    <div class="risk-description">Should be reviewed</div>
                </div>
                <div class="risk-card risk-low">
                    <div class="risk-number">${lowIssues}</div>
                    <div class="risk-label">Low Risk</div>
                    <div class="risk-description">Monitor for changes</div>
                </div>
                <div class="risk-card risk-safe">
                    <div class="risk-number">${secureNodesCount}</div>
                    <div class="risk-label">Secure Nodes</div>
                    <div class="risk-description">No issues detected</div>
                </div>
            </div>
        </div>
        
        <!-- Workflow Overview -->
        <div class="section">
            <h2>🔗 Workflow Overview</h2>
            <div class="workflow-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background: #ef4444;"></div>
                    <span>High Risk Nodes</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #f59e0b;"></div>
                    <span>Medium Risk Nodes</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #3b82f6;"></div>
                    <span>Low Risk Nodes</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #10b981;"></div>
                    <span>Secure Nodes</span>
                </div>
            </div>
            <div class="workflow-overview">
                <h3 style="margin-bottom: 1rem; color: #1e293b;">Node Categories</h3>
                <div class="node-categories">
                    ${Object.entries(nodeCategories)
                      .map(
                        ([category, count]) => `
                        <div class="category-item">
                            <div class="category-count">${count}</div>
                            <div class="category-label">${category}</div>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
                
                <div style="margin-top: 1rem;">
                    <strong>Node Types Detected:</strong> 
                    ${nodeTypes.length > 0 ? nodeTypes.join(", ") : "No specific node types identified"}
                </div>
                
                <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b;">
                    <strong>Total Workflow Nodes:</strong> ${actualNodes.length} 
                    ${workflowData?.nodes ? `(${workflowData.nodes.length - actualNodes.length} sticky notes excluded)` : ""}
                </div>
                ${screenshotDataUrl ? `
  <div class="section">
    <h2>🖼️ Workflow Visualization</h2>
    <img src="${screenshotDataUrl}" alt="Workflow Screenshot" style="width: 100%; border-radius: 12px; border: 1px solid #ccc;" />
  </div>
` : ''}
            </div>
        </div>
        
        <!-- Security Issues by Node -->
        ${
          Object.keys(issuesByNode).length > 0
            ? `
        <div class="section">
            <h2>🚨 Security Issues by Node</h2>
            ${Object.entries(issuesByNode)
              .map(
                ([nodeName, issues]: [string, any]) => `
                <div class="issue-node">
                    <div class="node-header">
                        📦 ${nodeName} (${issues.length} issue${issues.length !== 1 ? "s" : ""})
                    </div>
                    ${issues
                      .map(
                        (issue: SecurityIssue) => `
                        <div class="issue-item">
                            <div class="issue-header">
                                <div class="issue-title">${issue.type}</div>
                                <div class="severity-badge severity-${issue.severity}">${issue.severity}</div>
                            </div>
                            <div class="issue-message">${issue.message}</div>
                            ${
                              issue.description
                                ? `
                                <div class="issue-description">
                                    <strong>Description:</strong><br>
                                    ${issue.description}
                                </div>
                            `
                                : ""
                            }
                            ${
                              issue.remediation
                                ? `
                                <div class="issue-remediation">
                                    <strong>Remediation:</strong><br>
                                    ${issue.remediation}
                                </div>
                            `
                                : ""
                            }
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            `,
              )
              .join("")}
        </div>
        `
            : ""
        }
        
        <!-- Recommendations -->
        <div class="section">
            <div class="recommendations">
                <h3>💡 Security Recommendations</h3>
                <ul>
                    <li>Use n8n's built-in credential management system instead of hardcoding secrets</li>
                    <li>Enable HTTPS for all external HTTP requests to protect data in transit</li>
                    <li>Implement input validation and sanitization for all user inputs</li>
                    <li>Regular security audits and vulnerability assessments</li>
                    <li>Monitor workflow executions for suspicious activities</li>
                    <li>Use principle of least privilege for all credentials and permissions</li>
                    <li>Implement proper error handling and logging</li>
                    <li>Keep n8n and all node packages updated to latest versions</li>
                </ul>
            </div>
        </div>
        
        <!-- OWASP References -->
        <div class="section">
            <h2>📚 Security Framework References</h2>
            <p>This analysis is based on the following security frameworks:</p>
            <ul style="margin-top: 1rem; padding-left: 2rem;">
                <li><strong>OWASP LLM Top 10:</strong> Security risks specific to Large Language Models</li>
                <li><strong>OWASP Agentic AI Security:</strong> Security considerations for AI agents and autonomous systems</li>
                <li><strong>OWASP Web Application Security:</strong> Traditional web application security principles</li>
                <li><strong>n8n Security Best Practices:</strong> Platform-specific security guidelines</li>
            </ul>
        </div>
    </div>
    
    <div class="footer">
        <p>Generated by n8n Security Analyzer • ${timestamp}</p>
        <p>For more information about n8n security best practices, visit the official documentation</p>
    </div>
</body>
</html>
    `
  }

  if (!result || !result.isN8nWorkflow) {
    return null
  }

  const secureNodesCount = calculateSecureNodes()

  return (
    <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          Security Report Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Report Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {result.securityIssues.filter((i) => i.severity === "high").length}
              </div>
              <div className="text-slate-600 dark:text-slate-400">High Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {result.securityIssues.filter((i) => i.severity === "medium").length}
              </div>
              <div className="text-slate-600 dark:text-slate-400">Medium Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {result.securityIssues.filter((i) => i.severity === "low").length}
              </div>
              <div className="text-slate-600 dark:text-slate-400">Low Risk</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{secureNodesCount}</div>
              <div className="text-slate-600 dark:text-slate-400">Secure</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={generateReport}
            disabled={isGenerating}
            className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>

          {reportUrl && (
            <>
              <Button onClick={downloadReport} variant="outline" className="flex-1 bg-transparent">
                <Download className="h-4 w-4 mr-2" />
                Download HTML
              </Button>
              <Button onClick={viewReport} variant="outline" className="flex-1 bg-transparent">
                <Eye className="h-4 w-4 mr-2" />
                Preview Report
              </Button>
            </>
          )}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded border">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Report Features:</strong> Comprehensive security analysis • OWASP compliance mapping • Detailed
              remediation steps • Professional formatting • Printable layout • Workflow visualization summary
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
