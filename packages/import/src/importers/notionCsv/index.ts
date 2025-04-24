import * as fs from "fs";
import * as inquirer from "inquirer";
import { Importer } from "../../types";
import { ColumnMapping, NotionCsvImporter } from "./NotionCsvImporter";

const BASE_PATH = process.cwd();

const getCsvHeaders = async (filePath: string): Promise<string[]> => {
  const data = fs.readFileSync(filePath, "utf8");
  const headers = data.split("\n")[0].split(",");
  return headers;
};

export const notionCsvImport = async (): Promise<Importer> => {
  const filePathPrompt = await inquirer.prompt<FilePathAnswer>(filePathQuestion);
  const headers = await getCsvHeaders(filePathPrompt.notionFilePath);

  const availableColumns = [
    {
      name: "None/skip",
      value: null,
    },
    ...headers.map(header => ({
      name: header,
      value: header,
    })),
  ];

  const columnMapping = await inquirer.prompt<ColumnMapping>(getColumnMappingQuestions(availableColumns));
  // eslint-disable-next-line eqeqeq
  if (columnMapping.title == null) {
    throw new Error("Title column is required!");
  }

  // Sometimes (but not always?), inquirer returns a string with a leading BOM or a trailing newline
  const trimmedColumnMapping = {
    title: columnMapping.title.trim(),
    description: columnMapping.description?.trim() ?? null,
    priority: columnMapping.priority?.trim() ?? null,
    labels: columnMapping.labels?.map(label => label.trim()) ?? [],
    createdAt: columnMapping.createdAt?.trim() ?? null,
  };

  const notionImporter = new NotionCsvImporter(filePathPrompt.notionFilePath, trimmedColumnMapping);
  return notionImporter;
};

interface FilePathAnswer {
  notionFilePath: string;
}

const filePathQuestion = [
  {
    basePath: BASE_PATH,
    type: "filePath",
    name: "notionFilePath",
    message: "Select your exported CSV file",
  },
];

const getColumnMappingQuestions = (choices: { name: string; value: string | null }[]) => [
  {
    type: "list",
    name: "title",
    message: "What column contains a title?",
    choices,
  },
  {
    type: "list",
    name: "description",
    message: "What column (if any) contains a description?",
    choices,
  },
  {
    type: "list",
    name: "priority",
    message: "What column (if any) contains a priority?",
    choices,
  },
  {
    type: "checkbox",
    name: "labels",
    message: "What columns (if any, can also select multiple) contain labels?",
    choices,
  },
  {
    type: "list",
    name: "createdAt",
    message: "What column (if any) contains a created at time?",
    choices,
  },
];
