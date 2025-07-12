"use client"

import { useMemo, useCallback, forwardRef } from "react"
import ReactFlow, {
  type Node,
  type Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
} from "reactflow"
import "reactflow/dist/style.css"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  XCircle,
  Info,
  Zap,
  Database,
  Globe,
  Code,
  Mail,
  Calendar,
  Play,
  Settings,
  FileText,
  Brain,
  MessageSquare,
  Bot,
} from "lucide-react"

interface SecurityIssue {
  severity: "high" | "medium" | "low"
  type: string
  message: string
  nodeId?: string
  nodeName?: string
}

interface WorkflowVisualizationProps {
  workflowData: any
  securityIssues: SecurityIssue[]
}

// Custom Node Component
function CustomNode({ data }: { data: any }) {  

  const getNodeIcon = (nodeType: string) => {
    // Trigger nodes
    if (nodeType.includes("trigger") || nodeType.includes("webhook") || nodeType.includes("form")) return Play
    if (nodeType.includes("chat") && nodeType.includes("trigger")) return MessageSquare

    // AI and LangChain nodes
    if (nodeType.includes("agent")) return Bot
    if (nodeType.includes("lmChat") || nodeType.includes("openai") || nodeType.includes("gemini")) return Zap
    if (nodeType.includes("memory") || nodeType.includes("buffer")) return Brain
    if (nodeType.includes("tool") && nodeType.includes("calendar")) return Calendar
    if (nodeType.includes("langchain")) return Brain

    // HTTP and API nodes
    if (nodeType.includes("http") || nodeType.includes("webhook")) return Globe
    if (nodeType.includes("linkedin")) return MessageSquare

    // Data processing nodes
    if (nodeType.includes("code") || nodeType.includes("function")) return Code
    if (nodeType.includes("set") || nodeType.includes("edit")) return Settings

    // Database nodes
    if (nodeType.includes("database") || nodeType.includes("postgres") || nodeType.includes("mysql")) return Database

    // Communication nodes
    if (nodeType.includes("email") || nodeType.includes("gmail")) return Mail

    // Scheduling nodes
    if (nodeType.includes("schedule") || nodeType.includes("cron")) return Calendar

    // Google services
    if (nodeType.includes("google") && nodeType.includes("calendar")) return Calendar

    // Sticky notes and documentation
    if (nodeType.includes("sticky")) return FileText

    return FileText
    
  }
  

  const getSecurityColor = (level: string) => {
    switch (level) {
      case "high":
        return {
          border: "border-red-500",
          bg: "bg-red-50 dark:bg-red-950",
          text: "text-red=-700 dark:text-red-300",
          shadow: "shadow-red-200 dark:shadow-red-900",
        }
      case "medium":
        return {
          border: "border-yellow-500",
          bg: "bg-yellow-50 dark:bg-yellow-950",
          text: "text-yellow-700 dark:text-yellow-300",
          shadow: "shadow-yellow-200 dark:shadow-yellow-900",
        }
      case "low":
        return {
          border: "border-blue-500",
          bg: "bg-blue-50 dark:bg-blue-950",
          text: "text-blue-700 dark:text-blue-300",
          shadow: "shadow-blue-200 dark:shadow-blue-900",
        }
      default:
        return {
          border: "border-slate-300 dark:border-slate-600",
          bg: "bg-white dark:bg-slate-800",
          text: "text-slate-700 dark:text-slate-300",
          shadow: "shadow-slate-200 dark:shadow-slate-700",
        }
    }
  }

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

  const getSecurityIcon = (level: string) => {
    switch (level) {
      case "high":
        return <XCircle className="h-3 w-3" />
      case "medium":
        return <AlertTriangle className="h-3 w-3" />
      case "low":
        return <Info className="h-3 w-3" />
      default:
        return null
    }
  }

  const NodeIcon = getNodeIcon(data.type)
  const colors = getSecurityColor(data.securityLevel)
  const securityIcon = getSecurityIcon(data.securityLevel)

  return (
    <div className="group relative">
      {/* Handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-slate-500 rounded-full"
      />

      <div
        className={`
          relative min-w-[160px] rounded-lg border-2 shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer
          ${colors.border} ${colors.bg} ${colors.shadow}
        `}
      >
        {/* Node Header */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <NodeIcon className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-medium text-sm truncate ${colors.text}`}>{data.label}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{data.type?.split(".").pop()}</div>
          </div>
          {securityIcon && (
            <div className={`w-6 h-6 rounded-full border-2 ${colors.border} ${colors.bg} flex items-center justify-center`}>
              {securityIcon}
            </div>
          )}
        </div>

        {/* Node Status */}
        <div className="p-2">
          <div className="flex items-center justify-between">
            <Badge variant={data.securityLevel === "safe" ? "outline" : "destructive"} className="text-xs">
              {data.securityLevel === "safe" ? "Secure" : `${data.issueCount} Issues`}
            </Badge>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        </div>

        {/* Issue Bubble */}
        {data.issues?.length > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
            {data.issues.length}
          </div>
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs rounded-lg p-3 shadow-xl max-w-xs whitespace-nowrap">
          <div className="font-semibold mb-1">{data.label}</div>
          <div className="text-slate-300 dark:text-slate-600 mb-2">{data.type}</div>
          {data.issues?.length > 0 && (
            <div className="space-y-1">
              <div className="font-semibold text-red-400 dark:text-red-600">Security Issues:</div>
              {data.issues.slice(0, 3).map((issue: any, index: number) => (
                <div key={index} className="flex items-center gap-1">
                  <Badge variant={getSeverityColor(issue.severity)} className="text-xs">{issue.severity}</Badge>
                  <span className="text-xs">{issue.type}</span>
                </div>
              ))}
              {data.issues.length > 3 && (
                <div className="text-xs text-slate-400 dark:text-slate-500">+{data.issues.length - 3} more issues</div>
              )}
            </div>
          )}
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 dark:border-t-slate-100"></div>
      </div>

      {/* Handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-slate-500 rounded-full"
      />
    </div>
  )
}

const nodeTypes = {
  custom: CustomNode,
}

// Internal ReactFlow component that gets re-mounted when key changes
function ReactFlowVisualization({
  processedNodes,
  processedEdges,
}: {
  processedNodes: Node[]
  processedEdges: Edge[]
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(processedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(processedEdges)

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect} 
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.001}
      attributionPosition="bottom-left"
      className="bg-slate-50 dark:bg-slate-800"
    >
      <Controls className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg" />
      <MiniMap
        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg"
        nodeColor={(node) => {
          switch (node.data.securityLevel) {
            case "high":
              return "#ef4444"
            case "medium":
              return "#f59e0b"
            case "low":
              return "#3b82f6"
            default:
              return "#10b981"
          }
        }}
      />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="bg-slate-50 dark:bg-slate-800" color="#94a3b8" />
    </ReactFlow>
  )
}

export const WorkflowVisualization = forwardRef<HTMLDivElement, WorkflowVisualizationProps>(
  ({ workflowData, securityIssues }, ref) => {
  const { processedNodes, processedEdges, workflowKey } = useMemo(() => {

    const nodeNameToIdMap = Object.fromEntries(
  workflowData.nodes.map((node: any) => [node.name, node.id])
)
console.log("nodeNameToIdMap", nodeNameToIdMap)
    
    if (!workflowData?.nodes) return { processedNodes: [], processedEdges: [], workflowKey: "empty" }

    console.log("Raw workflow data:", workflowData)
    console.log("Connections object:", workflowData.connections)

    const getNodeSecurityLevel = (nodeId: string) => {
      const nodeIssues = securityIssues.filter((issue) => issue.nodeId === nodeId)
      if (nodeIssues.length === 0) return "safe"

      const hasHigh = nodeIssues.some((issue) => issue.severity === "high")
      const hasMedium = nodeIssues.some((issue) => issue.severity === "medium")

      if (hasHigh) return "high"
      if (hasMedium) return "medium"
      return "low"
    }

    // Create nodes
    
    const processedNodes: Node[] = workflowData.nodes.map((node: any, index: number) => {

      const securityLevel = getNodeSecurityLevel(node.id)
      const nodeIssues = securityIssues.filter((issue) => issue.nodeId === node.id)

      // Use existing position if available, otherwise create a better layout
      let x = 100
      let y = 100

      if (node.position && Array.isArray(node.position) && node.position.length >= 2) {
        x = node.position[0]
        y = node.position[1]
      } else {
        // Fallback grid layout
        x = (index % 6) * 200 + 100
        y = Math.floor(index / 6) * 150 + 100
      }

      // Special handling for sticky notes
      const isSticky = node.type.includes("stickyNote")
      

      return {
        id: node.id,
        type: isSticky ? "sticky" : "custom",
        position: { x, y },
        data: isSticky
          ? {
              label: node.parameters?.content || node.name || "Note",
            }
          : {
              label: node.name || node.type.split(".").pop() || "Unknown",
              type: node.type,
              securityLevel,
              issues: nodeIssues,
              issueCount: nodeIssues.length,
            },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: isSticky
          ? {
              zIndex: -999, // background
                background: "#fef3c7",
                border: "1px solid #f59e0b",
                borderRadius: "8px",
                fontSize: "12px",
                padding: "8px",
                whiteSpace: "pre-wrap",
                width: node.parameters?.width || 200,
                height: node.parameters?.height || 100,
            }
          : undefined,
      }
      
    })

    // Create edges - handle ALL connection types
    const processedEdges: Edge[] = []
    

    if (workflowData.connections && typeof workflowData.connections === "object") {
      // Iterate through each source node's connections

      Object.entries(workflowData.connections).forEach(([sourceNodeName, sourceConnections]: [string, any]) => {
        const sourceNodeId = nodeNameToIdMap[sourceNodeName]
        if (!sourceNodeId) {
            console.warn("⚠️ Unknown source node name:", sourceNodeName)
            return
        }
        console.log(`Processing connections for node ${sourceNodeId}:`, sourceConnections)

        if (sourceConnections && typeof sourceConnections === "object") {
          // Iterate through ALL connection types (main, ai_tool, ai_languageModel, ai_memory, etc.)
          Object.entries(sourceConnections).forEach(([connectionType, connectionData]: [string, any]) => {
            console.log(`Connection type ${connectionType}:`, connectionData)

            if (Array.isArray(connectionData)) {
              // connectionData is an array of output arrays
              connectionData.forEach((outputArray: any, outputIndex: number) => {
                console.log(`Output array ${outputIndex}:`, outputArray)

                if (Array.isArray(outputArray)) {
                  // Each outputArray contains connection objects
                  outputArray.forEach((connection: any, connectionIndex: number) => {
                    console.log(`Connection ${connectionIndex}:`, connection)

                    if (connection && connection.node) {
                      console.log(`Creating edge: ${sourceNodeId} -> ${connection.node} (type: ${connectionType})`)

                    
                      const sourceNode = processedNodes.find((n) => n.id === sourceNodeId)
                      const targetNodeId = nodeNameToIdMap[connection.node] || connection.node
                        const targetNode = processedNodes.find((n) => n.id === targetNodeId)  

                      // Different colors for different connection types
                      let edgeColor = "#64748b"
                      let strokeWidth = 2
                      let animated = false
                      let strokeDasharray = undefined

                      // Security-based styling
                      if (sourceNode?.data.securityLevel === "high" || targetNode?.data.securityLevel === "high") {
                        edgeColor = "#ef4444"
                        strokeWidth = 3
                        animated = true
                      } else if (
                        sourceNode?.data.securityLevel === "medium" ||
                        targetNode?.data.securityLevel === "medium"
                      ) {
                        edgeColor = "#f59e0b"
                        strokeWidth = 2.5
                      }

                      // Connection type styling
                      if (connectionType === "ai_tool") {
                        edgeColor = "#8b5cf6" // Purple for AI tools
                        strokeDasharray = "5,5"
                      } else if (connectionType === "ai_languageModel") {
                        edgeColor = "#06b6d4" // Cyan for language models
                        strokeDasharray = "10,5"
                      } else if (connectionType === "ai_memory") {
                        edgeColor = "#10b981" // Green for memory
                        strokeDasharray = "15,5"
                      }

                      const edgeId = `${sourceNodeId}-${connection.node}-${connectionType}-${outputIndex}-${connectionIndex}`

                      console.log("Source exists:", sourceNode)
                    console.log("Target exists:", targetNode)
                    console.log("Creating edge from", sourceNodeId, "to", targetNodeId)

                    if (!sourceNode || !targetNode) {
                    console.warn("Skipping edge due to missing node", {
                        sourceNodeId,
                        targetNodeId,
                        connection,
                    })
                    } else {
                    console.log("✅ Creating edge:", { sourceNodeId, targetNodeId, connectionType })
                    }

                      processedEdges.push({
                        id: edgeId,
                        source: sourceNodeId,
                        target: targetNodeId,
                        type: "default",
                        style: {
                          stroke: edgeColor,
                          strokeWidth,
                          strokeDasharray,
                        },
                        markerEnd: {
                          type: MarkerType.ArrowClosed,
                          color: edgeColor,
                        },
                        animated,
                        label: connectionType !== "main" ? connectionType.replace("ai_", "") : undefined,
                      })
                    }
                  })
                }
              })
            }
          })
        }
      })
    }

    console.log("Final processed nodes:", processedNodes.length)
    console.log("Final processed edges:", processedEdges.length)
    console.log("Edge details:", processedEdges)

    // Create a unique key based on workflow content to force re-mount
    const workflowKey = `workflow-${workflowData.name || "unnamed"}-${processedNodes.length}-${processedEdges.length}-${Date.now()}`

    return { processedNodes, processedEdges, workflowKey }
  }, [workflowData, securityIssues])

  console.log("[DEBUG] Processed Nodes (Including Sticky):", processedNodes)

  // Filter out sticky nodes, exclude it from count
  const workflowNodes = processedNodes.filter((node: any) => !node.type.includes("sticky"))
  console.log("[DEBUG] Workflow Nodes:", workflowNodes)

  if (processedNodes.length === 0) {
    return (
      <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            Workflow Visualization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Workflow Data</h3>
            <p className="text-slate-500 dark:text-slate-400">Upload a valid n8n workflow to see the visualization</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
     
        <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
        <CardHeader>
            <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
            </div>
            Interactive Workflow Visualization
            </CardTitle>
            <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-400">
                Secure ({processedNodes.filter((n) => n.data.securityLevel === "safe").length})
                </span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-400">Low Risk</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-400">Medium Risk</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-slate-600 dark:text-slate-400">High Risk</span>
            </div>
            <div className="text-slate-500 dark:text-slate-400">
                • {workflowNodes.length} nodes • {processedEdges.length} connections
            </div>
            </div>

            {/* Connection Type Legend */}
            <div className="flex items-center gap-4 text-xs mt-2 flex-wrap">
            <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-slate-500"></div>
                <span className="text-slate-600 dark:text-slate-400">Main Flow</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-purple-500" style={{ borderTop: "1px dashed" }}></div>
                <span className="text-slate-600 dark:text-slate-400">AI Tool</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-cyan-500" style={{ borderTop: "1px dashed" }}></div>
                <span className="text-slate-600 dark:text-slate-400">Language Model</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-green-500" style={{ borderTop: "1px dashed" }}></div>
                <span className="text-slate-600 dark:text-slate-400">Memory</span>
            </div>
            </div>
        </CardHeader>
        <CardContent>
            <div ref={ref}>
            <div className="w-full h-[700px] bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Key prop forces React Flow to re-mount when workflow changes */}
            <ReactFlowVisualization key={workflowKey} processedNodes={processedNodes} processedEdges={processedEdges} />
            </div>
            </div>

            {/* Debug Information */}
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
            <div className="text-sm text-slate-600 dark:text-slate-400">
                <strong>Debug Info:</strong> {processedNodes.length} nodes processed, {processedEdges.length} edges created
                <span className="ml-2 text-xs">Key: {workflowKey}</span>
                {processedEdges.length === 0 && workflowData.connections && (
                <span className="text-red-600 dark:text-red-400 ml-2">
                    ⚠️ No edges found - check browser console for connection parsing details
                </span>
                )}
            </div>
            </div>

            {/* Security Summary */}
            {securityIssues.length > 0 && (
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Security Summary
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {securityIssues.filter((i) => i.severity === "high").length}
                    </div>
                    <div className="text-red-700 dark:text-red-300 font-medium">High Risk</div>
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">Immediate attention required</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {securityIssues.filter((i) => i.severity === "medium").length}
                    </div>
                    <div className="text-yellow-700 dark:text-yellow-300 font-medium">Medium Risk</div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Should be reviewed</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {securityIssues.filter((i) => i.severity === "low").length}
                    </div>
                    <div className="text-blue-700 dark:text-blue-300 font-medium">Low Risk</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Monitor for changes</div>
                </div>
                </div>
            </div>
            )}

            {/* Instructions */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Interactive Features:</strong> Drag nodes to reposition • Zoom with mouse wheel • Pan by dragging
                background • Hover nodes for security details • Different line styles show connection types
                </div>
            </div>
            </div>
        </CardContent>
        </Card>
    
  )
})
