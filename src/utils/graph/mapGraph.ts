/**
 * @path src/utils/graph/mapGraph.ts
 * @param raw: Neo4jGraph
 * @returns mapped graph: FormattedGraph
 * @description parses and maps relevant fields from Neo4j graph to FormattedGraph format
 */
import { Edge, LogicNode, FormattedGraph } from "@/types/graphTypes";
import type { Node as NeoNode } from "neo4j-driver";
import { Neo4jGraph } from "@/types/neo4jTypes";
import {
  AVAIL_GRADES,
  Exam,
  Grade,
  ModuleData,
  ModuleStatus,
  SemesterLabel,
} from "@/types/plannerTypes";

export function mapGraph(graph: Neo4jGraph): FormattedGraph {
  const { nodes: neo4jNodes, relationships: neo4jRels } = graph;
  const nodes: Record<string, ModuleData | LogicNode> = {};

  const relationships: Edge[] = neo4jRels.map((rel) => ({
    id: rel.elementId,
    from: rel.startNodeElementId,
    to: rel.endNodeElementId,
  }));

  for (const node of neo4jNodes) {
    const id = node.elementId;

    if (node.labels.includes("Module")) {
      nodes[id] = mapModuleData(node);
    } else if (node.labels.includes("Logic")) {
      const type = node.properties.type;
      if (type === "AND") {
        nodes[id] = { id, type: "AND" };
      } else if (type === "OR") {
        nodes[id] = { id, type: "OR" };
      } else if (type === "NOF") {
        nodes[id] = { id, type: "NOF", n: node.properties.threshold ?? 1 };
      }
    }
  }

  return { nodes, relationships };
}

export function mapModuleData(node: NeoNode): ModuleData {
  const props = node.properties;

  // Parse semesterData → semestersOffered + exam
  let semestersOffered: SemesterLabel[] = [];
  let exam: Exam | null = null;

  try {
    const semesterArray = JSON.parse(props.semesterData ?? "[]");

    if (Array.isArray(semesterArray)) {
      semestersOffered = semesterArray.map((s: any) => {
        switch (s.semester) {
        case 1:
          return SemesterLabel.First;
        case 2:
          return SemesterLabel.Second;
        case 3:
          return SemesterLabel.SpecialTerm1;
        case 4:
          return SemesterLabel.SpecialTerm2;
        default:
          return null;
        }
      }) as SemesterLabel[];

      const withExam = semesterArray.find((s: any) => s.examDate);
      if (withExam) {
        exam = {
          startTime: withExam.examDate,
          durationMinutes: parseInt(withExam.examDuration ?? "0"),
        };
      }
    }
  } catch {
    semestersOffered = [];
    exam = null;
  }

  // Extract preclusions from string
  const preclusions: string[] = [];
  if (typeof props.preclusion === "string") {
    const matches = props.preclusion.match(/\b[A-Z]{2,3}\d{4}[A-Z]?\b/g);
    if (matches) preclusions.push(...matches);
  }

  // Ensure grade is a valid Grade enum
  const validGrades = AVAIL_GRADES;
  const rawGrade = typeof props.grade === "string" ? props.grade : undefined;
  const grade = validGrades.includes(rawGrade as Grade)
    ? (rawGrade as Grade)
    : undefined;

  // Determine status
  let status: ModuleStatus | undefined;
  if (grade) {
    status = ModuleStatus.Completed;
  } else if (typeof props.status === "string" && Object.values(ModuleStatus).includes(props.status as ModuleStatus)) {
    status = props.status as ModuleStatus;
  }

  return {
    id: node.identity.toString(),
    code: props.moduleCode,
    title: props.title?.trim() ?? "Untitled Module",
    credits: parseInt(props.moduleCredit ?? "0"),
    semestersOffered,
    exam,
    preclusions,
    plannedSemester:
      props.plannedSemester !== undefined
        ? parseInt(props.plannedSemester)
        : null,
    grade,
    status,
    description: props.description ?? undefined,
    faculty: props.faculty ?? undefined,
    department: props.department ?? undefined,
  };
}
