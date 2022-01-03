import {
  getTypes,
  ParamTransform,
  parseSQLFile,
  parseTypeScriptFile,
  prettyPrintEvents,
  processSQLQueryAST,
  processTSQueryAST,
  Query,
  QueryParam,
  SQLQueryAST,
  TSQueryAST,
} from '@pgtyped/query';
import { OIDs } from '@pgtyped/types';
import { camelCase } from 'camel-case';
import { pascalCase } from 'pascal-case';
import path from 'path';
import { ParsedConfig } from './config';
import { ProcessingMode } from './index';
import { DefaultTypeMapping, TypeAllocator } from './types';

export interface IField {
  fieldName: string;
  fieldType: string;
}

const interfaceGen = (interfaceName: string, contents: string) =>
  `export interface ${interfaceName} {
${contents}
}\n\n`;

export const generateInterface = (interfaceName: string, fields: IField[]) => {
  const sortedFields = fields
    .slice()
    .sort((a, b) => a.fieldName.localeCompare(b.fieldName));
  const contents = sortedFields
    .map(({ fieldName, fieldType }) => `  ${fieldName}: ${fieldType};`)
    .join('\n');
  return interfaceGen(interfaceName, contents);
};

export const generateTypeAlias = (typeName: string, alias: string) =>
  `export type ${typeName} = ${alias};\n\n`;

type ParsedQuery =
  | {
      ast: TSQueryAST;
      mode: ProcessingMode.TS;
    }
  | {
      ast: SQLQueryAST;
      mode: ProcessingMode.SQL;
    };

export async function queryToTypeDeclarations(
  parsedQuery: ParsedQuery,
  connection: any,
  types: TypeAllocator,
  config: ParsedConfig,
): Promise<{ typeDeclaration: string; typedAST: Query }> {
  let queryData;
  let queryName;
  if (parsedQuery.mode === ProcessingMode.TS) {
    queryName = pascalCase(parsedQuery.ast.name);
    queryData = processTSQueryAST(parsedQuery.ast);
  } else {
    queryName = pascalCase(parsedQuery.ast.name);
    queryData = processSQLQueryAST(parsedQuery.ast);
  }

  const typeData = await getTypes(queryData, connection);
  const interfaceName = pascalCase(queryName);

  if ('errorCode' in typeData) {
    // tslint:disable-next-line:no-console
    console.error('Error in query. Details: %o', typeData);
    const returnInterface = generateTypeAlias(
      `I${interfaceName}Result`,
      'never',
    );
    const paramInterface = generateTypeAlias(
      `I${interfaceName}Params`,
      'never',
    );
    const resultErrorComment = `/** Query '${queryName}' is invalid, so its result is assigned type 'never' */\n`;
    const paramErrorComment = `/** Query '${queryName}' is invalid, so its parameters are assigned type 'never' */\n`;
    return {
      typeDeclaration: `${resultErrorComment}${returnInterface}${paramErrorComment}${paramInterface}`,
      typedAST: parsedQuery.ast,
    };
  }

  const { returnTypes, paramMetadata } = typeData;

  const returnFieldTypes: IField[] = [];
  const paramFieldTypes: IField[] = [];

  returnTypes.forEach(({ returnName, type, nullable }) => {
    let tsTypeName = types.use(type);
    if (nullable || nullable == null) {
      tsTypeName += ' | null';
    }

    returnFieldTypes.push({
      fieldName: config.camelCaseColumnNames
        ? camelCase(returnName)
        : returnName,
      fieldType: tsTypeName,
    });
  });

  const { params } = paramMetadata;
  for (const param of paramMetadata.mapping) {
    if (
      param.type === ParamTransform.Scalar ||
      param.type === ParamTransform.Spread
    ) {
      const isArray = param.type === ParamTransform.Spread;
      const assignedIndex =
        param.assignedIndex instanceof Array
          ? param.assignedIndex[0]
          : param.assignedIndex;
      const { oid, typeName: pgTypeName } = params[assignedIndex - 1];
      const knownOID = oid in OIDs;

      let tsTypeName = types.use(
        pgTypeName,
        types.isMappedType(oid) ? pgTypeName : undefined,
      );

      (parsedQuery.ast.params[assignedIndex - 1] as QueryParam).type = {
        oid,
        ...(!knownOID && { customType: pgTypeName as string }),
      };

      if (!param.required) {
        tsTypeName += ' | null | void';
      }

      paramFieldTypes.push({
        fieldName: param.name,
        fieldType: isArray ? `readonly (${tsTypeName})[]` : tsTypeName,
      });
    } else {
      const isArray = param.type === ParamTransform.PickSpread;
      let fieldType = Object.values(param.dict)
        .map((p) => {
          const { oid, typeName: postgresType } = params[p.assignedIndex - 1];
          const knownOID = oid in OIDs;
          const paramType = types.use(
            postgresType,
            types.isMappedType(oid) ? pgTypeName : undefined,
          );
          // TODO check met meerder dingen in de pick, en de array pick.Bv. id erbij en omwisselen van plek.
          // dus er voor zorgen dat de [p.assignedIndex-1] van de parsedQuery.ast.params ook op dezelfde plek staat als
          // params[p.assignedIndex-1]
          parsedQuery.ast.params[p.assignedIndex - 1].type = {
            oid,
            ...(!knownOID && { customType: postgresType as string }),
          };
          return p.required
            ? `    ${p.name}: ${paramType}`
            : `    ${p.name}: ${paramType} | null | void`;
        })
        .join(',\n');
      fieldType = `{\n${fieldType}\n  }`;
      if (isArray) {
        fieldType = `readonly (${fieldType})[]`;
      }
      paramFieldTypes.push({
        fieldName: param.name,
        fieldType,
      });
    }
  }

  // TypeAllocator errors are currently considered non-fatal since a `never`
  // type is emitted which can be caught later when compiling the generated
  // code
  // tslint:disable-next-line:no-console
  types.errors.forEach((err) => console.log(err));

  const resultInterfaceName = `I${interfaceName}Result`;
  const returnTypesInterface =
    `/** '${queryName}' return type */\n` +
    (returnFieldTypes.length > 0
      ? generateInterface(`I${interfaceName}Result`, returnFieldTypes)
      : generateTypeAlias(resultInterfaceName, 'void'));

  const paramInterfaceName = `I${interfaceName}Params`;
  const paramTypesInterface =
    `/** '${queryName}' parameters type */\n` +
    (paramFieldTypes.length > 0
      ? generateInterface(`I${interfaceName}Params`, paramFieldTypes)
      : generateTypeAlias(paramInterfaceName, 'void'));

  const typePairInterface =
    `/** '${queryName}' query type */\n` +
    generateInterface(`I${interfaceName}Query`, [
      { fieldName: 'params', fieldType: paramInterfaceName },
      { fieldName: 'result', fieldType: resultInterfaceName },
    ]);

  return {
    typeDeclaration: [
      paramTypesInterface,
      returnTypesInterface,
      typePairInterface,
    ].join(''),
    typedAST: parsedQuery.ast,
  };
}

type ITypedQuery =
  | {
      mode: 'ts';
      fileName: string;
      query: {
        name: string;
        ast: TSQueryAST;
      };
      typeDeclaration: string;
    }
  | {
      mode: 'sql';
      fileName: string;
      query: {
        name: string;
        ast: SQLQueryAST;
        paramTypeAlias: string;
        returnTypeAlias: string;
      };
      typeDeclaration: string;
    };

async function generateTypedecsFromFile(
  contents: string,
  fileName: string,
  connection: any,
  mode: 'ts' | 'sql',
  types: TypeAllocator = new TypeAllocator(DefaultTypeMapping),
  config: ParsedConfig,
): Promise<ITypedQuery[]> {
  const results: ITypedQuery[] = [];

  const { queries, events } =
    mode === 'ts'
      ? parseTypeScriptFile(contents, fileName)
      : parseSQLFile(contents);
  if (events.length > 0) {
    prettyPrintEvents(contents, events);
    if (events.find((e) => 'critical' in e)) {
      return results;
    }
  }
  for (const queryAST of queries) {
    let typedQuery: ITypedQuery;
    if (mode === 'sql') {
      const sqlQueryAST = queryAST as SQLQueryAST;
      const { typeDeclaration, typedAST } = await queryToTypeDeclarations(
        { ast: sqlQueryAST, mode: ProcessingMode.SQL },
        connection,
        types,
        config,
      );
      typedQuery = {
        mode: 'sql' as const,
        query: {
          name: camelCase(typedAST.name),
          ast: typedAST as SQLQueryAST,
          paramTypeAlias: `I${pascalCase(typedAST.name)}Params`,
          returnTypeAlias: `I${pascalCase(typedAST.name)}Result`,
        },
        fileName,
        typeDeclaration,
      };
    } else {
      const tsQueryAST = queryAST as TSQueryAST;
      const { typeDeclaration, typedAST } = await queryToTypeDeclarations(
        {
          ast: tsQueryAST,
          mode: ProcessingMode.TS,
        },
        connection,
        types,
        config,
      );
      typedQuery = {
        mode: 'ts' as const,
        fileName,
        query: {
          name: typedAST.name,
          ast: typedAST as TSQueryAST,
        },
        typeDeclaration,
      };
    }
    results.push(typedQuery);
  }
  return results;
}

export async function generateDeclarationFile(
  contents: string,
  fileName: string,
  connection: any,
  mode: 'ts' | 'sql',
  types: TypeAllocator = new TypeAllocator(DefaultTypeMapping),
  config: ParsedConfig,
): Promise<{ typeDecs: ITypedQuery[]; declarationFileContents: string }> {
  if (mode === 'sql') {
    types.use({ name: 'PreparedQuery', from: '@pgtyped/query' });
  }
  const typeDecs = await generateTypedecsFromFile(
    contents,
    fileName,
    connection,
    mode,
    types,
    config,
  );

  // file paths in generated files must be stable across platforms
  // https://github.com/adelsz/pgtyped/issues/230
  const isWindowsPath = path.sep === '\\';
  // always emit POSIX paths
  const stableFilePath = isWindowsPath
    ? fileName.replace(/\\/g, '/')
    : fileName;

  let declarationFileContents = '';
  declarationFileContents += `/** Types generated for queries found in "${stableFilePath}" */\n`;
  declarationFileContents += types.declaration();
  declarationFileContents += '\n';
  for (const typeDec of typeDecs) {
    declarationFileContents += typeDec.typeDeclaration;
    if (typeDec.mode === 'ts') {
      continue;
    }
    const queryPP = typeDec.query.ast.statement.body
      .split('\n')
      .map((s: string) => ' * ' + s)
      .join('\n');
    declarationFileContents += `const ${
      typeDec.query.name
    }IR: any = ${JSON.stringify(typeDec.query.ast)};\n\n`;
    declarationFileContents +=
      `/**\n` +
      ` * Query generated from SQL:\n` +
      ` * \`\`\`\n` +
      `${queryPP}\n` +
      ` * \`\`\`\n` +
      ` */\n`;
    declarationFileContents +=
      `export const ${typeDec.query.name} = ` +
      `new PreparedQuery<${typeDec.query.paramTypeAlias},${typeDec.query.returnTypeAlias}>` +
      `(${typeDec.query.name}IR);\n\n\n`;
  }
  return { declarationFileContents, typeDecs };
}
