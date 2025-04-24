import csv from "csvtojson";
import * as inquirer from "inquirer";
import { Importer, ImportResult, IssuePriority } from "../../types";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const j2m = require("jira2md");

type NotionPriority = "P0" | "P1" | "P2" | "High" | "Medium" | "Low" | "";

export interface ColumnMapping {
  title: string;
  description: string | null;
  priority: string | null;
  labels: string[] | null;
  createdAt: string | null;
}

interface NotionDatabaseRow {
  title: string;
  description?: string;
  priority?: IssuePriority;
  labels?: string[];
  createdAt?: Date;
}
/**
 * Import issues from an Notion CSV export.
 *
 * @param filePath  path to csv file
 */
export class NotionCsvImporter implements Importer {
  public constructor(filePath: string, columnMapping: ColumnMapping) {
    this.filePath = filePath;
    this.columnMapping = columnMapping;
  }

  public get name(): string {
    return "Notion (CSV)";
  }

  public get defaultTeamName(): string {
    return "Notion";
  }

  private getLabels = (row: { [key: string]: string }): string[] => {
    if (!this.columnMapping.labels) {
      return [];
    }

    const labels: string[] = [];
    for (const labelColumn of this.columnMapping.labels) {
      labels.push(
        ...(row[labelColumn] ?? "")
          .split(",")
          .map(tag => tag.trim())
          .filter(tag => !!tag && tag.trim() !== "")
      );
    }

    return labels;
  };

  public import = async (): Promise<ImportResult> => {
    const data = (await csv().fromFile(this.filePath)) as {
      [key: string]: string;
    }[];
    const mappedData: NotionDatabaseRow[] = data.map(row => ({
      title: row[this.columnMapping.title.trim()],
      description: this.columnMapping.description ? j2m.to_markdown(row[this.columnMapping.description]) : undefined,
      priority: this.columnMapping.priority
        ? mapPriority(row[this.columnMapping.priority] as NotionPriority)
        : undefined,
      labels: this.getLabels(row),
      createdAt: this.columnMapping.createdAt ? new Date(row[this.columnMapping.createdAt]) : undefined,
    }));

    const importData: ImportResult = {
      issues: [],
      labels: {},
      users: {},
      statuses: {},
    };

    for (const issue of mappedData) {
      // eslint-disable-next-line eqeqeq
      if (issue.title == null || issue.title.trim() === "") {
        // eslint-disable-next-line no-console
        console.warn(`Skipping row, missing required title: ${JSON.stringify(issue)}`);
        continue;
      }

      importData.issues.push(issue);

      for (const lab of issue.labels ?? []) {
        if (!importData.labels[lab]) {
          importData.labels[lab] = {
            name: lab,
          };
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `The following labels will be used or created: ${Object.values(importData.labels)
        .map(label => label.name)
        .join(", ")}`
    );
    const { confirm }: { confirm: boolean } = await inquirer.prompt({
      type: "confirm",
      name: "confirm",
      message: "Are you sure you want to continue?",
    });

    if (!confirm) {
      throw new Error("User cancelled import");
    }

    return importData;
  };

  // -- Private interface

  private filePath: string;
  private columnMapping: ColumnMapping;
}

const mapPriority = (input: string): IssuePriority => {
  const priorityMap: { [k in NotionPriority]: IssuePriority } = {
    "": 0, // 0 = no priority
    P0: 2, // 2 = high
    P1: 3, // 3 = medium
    P2: 4, // 4 = low
    High: 2, // 2 = high
    Medium: 3, // 3 = medium
    Low: 4, // 4 = low
  };
  if (input in priorityMap) {
    return priorityMap[input as NotionPriority];
  }
  // 0 = missing priority
  // eslint-disable-next-line no-console
  console.warn(`Unexpected priority, will create with missing priority instead: ${input}`);
  return 0;
};
