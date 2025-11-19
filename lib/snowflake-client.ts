// import snowflake from "snowflake-sdk"

// Snowflake connection configuration
const snowflakeConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT || "",
  username: process.env.SNOWFLAKE_USERNAME || "",
  password: process.env.SNOWFLAKE_PASSWORD || "",
  warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
  database: process.env.SNOWFLAKE_DATABASE || "",
  schema: process.env.SNOWFLAKE_SCHEMA || "COMPANY_PROFILE",
  role: process.env.SNOWFLAKE_ROLE || "",
  table: process.env.SNOWFLAKE_TABLE || "FREECOMPANYDATASET",
}

// Company data structure from Snowflake
export interface SnowflakeCompany {
  ID?: string
  NAME?: string
  WEBSITE?: string
  INDUSTRY?: string
  LOCALITY?: string
  REGION?: string
  COUNTRY?: string
  SIZE?: string
  FOUNDED?: number
  LINKEDIN_URL?: string
}

// Create a connection to Snowflake
async function createConnection(): Promise<any> {
  const snowflake = (await import("snowflake-sdk")).default

  return new Promise((resolve, reject) => {
    // Validate configuration before connecting
    if (!snowflakeConfig.account || !snowflakeConfig.username || !snowflakeConfig.password) {
      const missing = []
      if (!snowflakeConfig.account) missing.push("SNOWFLAKE_ACCOUNT")
      if (!snowflakeConfig.username) missing.push("SNOWFLAKE_USERNAME")
      if (!snowflakeConfig.password) missing.push("SNOWFLAKE_PASSWORD")
      
      const error = new Error(`Missing Snowflake configuration: ${missing.join(", ")}`)
      console.error("[v0] [Snowflake] Configuration error:", error.message)
      reject(error)
      return
    }

    try {
      const connection = snowflake.createConnection(snowflakeConfig)

      connection.connect((err: any, conn: any) => {
        if (err) {
          console.error("[v0] [Snowflake] Connection failed:", err.message)
          reject(err)
        } else {
          console.log("[v0] [Snowflake] Successfully connected")
          resolve(conn)
        }
      })
    } catch (err: any) {
      console.error("[v0] [Snowflake] Error creating connection:", err.message)
      reject(err)
    }
  })
}

// Execute a query on Snowflake
function executeQuery<T = any>(connection: any, sqlText: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err: any, stmt: any, rows: any) => {
        if (err) {
          console.error("[v0] [Snowflake] Query failed:", err.message)
          reject(err)
        } else {
          console.log("[v0] [Snowflake] Query completed, rows:", rows?.length || 0)
          resolve((rows as T[]) || [])
        }
      },
    })
  })
}

import { buildIntelligentSearchSQL, parseSearchQuery } from "./snowflake-intelligent-search"

// Search companies in Snowflake by query
export async function searchSnowflakeCompanies(
  query: string,
  limit: number = 50,
): Promise<SnowflakeCompany[]> {
  return searchSnowflakeCompaniesAdvanced({ query, limit })
}

// Get company by domain
export async function getSnowflakeCompanyByDomain(domain: string): Promise<SnowflakeCompany | null> {
  let connection: any = null

  try {
    console.log("[v0] [Snowflake] Looking up company by domain:", domain)
    connection = await createConnection()

    const tableName = `${snowflakeConfig.database}.${snowflakeConfig.schema}.${snowflakeConfig.table}`

    const sqlText = `
      SELECT 
        ID,
        NAME,
        WEBSITE,
        INDUSTRY,
        LOCALITY,
        REGION,
        COUNTRY,
        SIZE,
        FOUNDED,
        LINKEDIN_URL
      FROM ${tableName}
      WHERE LOWER(WEBSITE) LIKE LOWER('%${domain}%')
      LIMIT 1
    `

    const results = await executeQuery<SnowflakeCompany>(connection, sqlText)

    if (results.length > 0) {
      console.log("[v0] [Snowflake] Found company:", results[0].NAME)
      return results[0]
    }

    console.log("[v0] [Snowflake] No company found for domain:", domain)
    return null
  } catch (error: any) {
    console.error("[v0] [Snowflake] Lookup error:", error.message)
    throw new Error(`Snowflake lookup failed: ${error.message}`)
  } finally {
    if (connection) {
      connection.destroy((err: any) => {
        if (err) {
          console.error("[v0] [Snowflake] Error closing connection:", err.message)
        }
      })
    }
  }
}

// Search companies in Snowflake by advanced query
export async function searchSnowflakeCompaniesAdvanced(params: {
  query?: string
  industry?: string
  employeeRange?: string
  revenueRange?: string
  location?: string
  limit?: number
}): Promise<SnowflakeCompany[]> {
  let connection: any = null

  try {
    console.log("[v0] [Snowflake] Intelligent search with params:", params)
    connection = await createConnection()

    const tableName = `${snowflakeConfig.database}.${snowflakeConfig.schema}.${snowflakeConfig.table}`
    const limit = params.limit || 50

    let sqlText: string

    if (params.query && params.query.trim()) {
      console.log("[v0] [Snowflake] Using intelligent search for query:", params.query)
      
      sqlText = await buildIntelligentSearchSQL(
        tableName,
        params.query,
        {
          location: params.location,
          employeeRange: params.employeeRange,
        }
      )
      
      sqlText += ` LIMIT ${limit}`
    } else {
      const conditions: string[] = []

      if (params.industry && params.industry.trim()) {
        conditions.push(`LOWER(INDUSTRY) LIKE LOWER('%${params.industry.trim()}%')`)
      }

      if (params.employeeRange && params.employeeRange.trim()) {
        conditions.push(`SIZE = '${params.employeeRange.trim()}'`)
      }

      if (params.location && params.location.trim()) {
        conditions.push(`(
          LOWER(LOCALITY) LIKE LOWER('%${params.location.trim()}%')
          OR LOWER(REGION) LIKE LOWER('%${params.location.trim()}%')
          OR LOWER(COUNTRY) LIKE LOWER('%${params.location.trim()}%')
        )`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "WHERE 1=1"

      sqlText = `
        SELECT 
          ID,
          NAME,
          WEBSITE,
          INDUSTRY,
          LOCALITY,
          REGION,
          COUNTRY,
          SIZE,
          FOUNDED,
          LINKEDIN_URL
        FROM ${tableName}
        ${whereClause}
        ORDER BY FOUNDED DESC NULLS LAST
        LIMIT ${limit}
      `
    }

    console.log("[v0] [Snowflake] Executing SQL:", sqlText)

    const results = await executeQuery<SnowflakeCompany>(connection, sqlText)
    console.log("[v0] [Snowflake] Advanced search found", results.length, "companies")

    return results
  } catch (error: any) {
    console.error("[v0] [Snowflake] Advanced search error:", error.message)
    throw new Error(`Snowflake advanced search failed: ${error.message}`)
  } finally {
    if (connection) {
      connection.destroy((err: any) => {
        if (err) {
          console.error("[v0] [Snowflake] Error closing connection:", err.message)
        } else {
          console.log("[v0] [Snowflake] Connection closed")
        }
      })
    }
  }
}

// List Snowflake tables
export async function listSnowflakeTables(): Promise<string[]> {
  let connection: any = null

  try {
    console.log("[v0] [Snowflake] Listing available tables")
    connection = await createConnection()

    const sqlText = `
      SHOW TABLES IN ${snowflakeConfig.database}.${snowflakeConfig.schema}
    `

    const results = await executeQuery<any>(connection, sqlText)
    const tableNames = results.map((row: any) => row.name || row.NAME || row.table_name || row.TABLE_NAME)
    
    console.log("[v0] [Snowflake] Available tables:", tableNames)
    return tableNames
  } catch (error: any) {
    console.error("[v0] [Snowflake] Error listing tables:", error.message)
    throw new Error(`Failed to list tables: ${error.message}`)
  } finally {
    if (connection) {
      connection.destroy((err: any) => {
        if (err) {
          console.error("[v0] [Snowflake] Error closing connection:", err.message)
        }
      })
    }
  }
}

// Check Snowflake permissions
export async function checkSnowflakePermissions(): Promise<{
  canConnect: boolean
  canListTables: boolean
  canQuery: boolean
  availableTables: string[]
  error?: string
}> {
  const result = {
    canConnect: false,
    canListTables: false,
    canQuery: false,
    availableTables: [] as string[],
    error: undefined as string | undefined,
  }

  let connection: any = null

  try {
    // Test connection
    connection = await createConnection()
    result.canConnect = true
    console.log("[v0] [Snowflake] Permission check: Can connect ✓")

    // Test list tables
    try {
      const tables = await listSnowflakeTables()
      result.canListTables = true
      result.availableTables = tables
      console.log("[v0] [Snowflake] Permission check: Can list tables ✓")
      console.log("[v0] [Snowflake] Available tables:", tables)
    } catch (err: any) {
      console.error("[v0] [Snowflake] Permission check: Cannot list tables ✗", err.message)
      result.error = `Cannot list tables: ${err.message}`
    }

    // Test simple query if we have tables
    if (result.availableTables.length > 0) {
      try {
        const testTable = result.availableTables[0]
        const sqlText = `SELECT * FROM ${snowflakeConfig.database}.${snowflakeConfig.schema}.${testTable} LIMIT 1`
        await executeQuery(connection, sqlText)
        result.canQuery = true
        console.log("[v0] [Snowflake] Permission check: Can query ✓")
      } catch (err: any) {
        console.error("[v0] [Snowflake] Permission check: Cannot query ✗", err.message)
        result.error = `Cannot query: ${err.message}`
      }
    }

    return result
  } catch (error: any) {
    result.error = error.message
    console.error("[v0] [Snowflake] Permission check failed:", error.message)
    return result
  } finally {
    if (connection) {
      connection.destroy((err: any) => {
        if (err) {
          console.error("[v0] [Snowflake] Error closing connection:", err.message)
        }
      })
    }
  }
}
