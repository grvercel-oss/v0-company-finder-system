// import snowflake from "snowflake-sdk"

// Snowflake connection configuration
const snowflakeConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT || "",
  username: process.env.SNOWFLAKE_USERNAME || "",
  password: process.env.SNOWFLAKE_PASSWORD || "",
  warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
  database: process.env.SNOWFLAKE_DATABASE || "",
  schema: process.env.SNOWFLAKE_SCHEMA || "PUBLIC",
  role: process.env.SNOWFLAKE_ROLE || "",
  table: process.env.SNOWFLAKE_TABLE || "COMPANIES",
}

// Company data structure from Snowflake
export interface SnowflakeCompany {
  company_id?: string
  company_name?: string
  domain?: string
  website?: string
  description?: string
  industry?: string
  sub_industry?: string
  employee_count?: number
  employee_range?: string
  revenue?: number
  revenue_range?: string
  founded_year?: number
  headquarters_city?: string
  headquarters_state?: string
  headquarters_country?: string
  linkedin_url?: string
  twitter_url?: string
  facebook_url?: string
  technologies?: string
  keywords?: string
  phone?: string
  address?: string
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

// Search companies in Snowflake by query
export async function searchSnowflakeCompanies(
  query: string,
  limit: number = 50,
): Promise<SnowflakeCompany[]> {
  let connection: any = null

  try {
    console.log("[v0] [Snowflake] Starting search for:", query)
    connection = await createConnection()

    const tableName = `${snowflakeConfig.database}.${snowflakeConfig.schema}.${snowflakeConfig.table}`
    console.log("[v0] [Snowflake] Using table:", tableName)

    // Build search query - adjust table name based on your actual Snowflake setup
    // This is a generic query that searches across multiple fields
    const sqlText = `
      SELECT 
        company_id,
        company_name,
        domain,
        website,
        description,
        industry,
        sub_industry,
        employee_count,
        employee_range,
        revenue,
        revenue_range,
        founded_year,
        headquarters_city,
        headquarters_state,
        headquarters_country,
        linkedin_url,
        twitter_url,
        facebook_url,
        technologies,
        keywords,
        phone,
        address
      FROM ${tableName}
      WHERE 
        LOWER(company_name) LIKE LOWER('%${query}%')
        OR LOWER(description) LIKE LOWER('%${query}%')
        OR LOWER(industry) LIKE LOWER('%${query}%')
        OR LOWER(keywords) LIKE LOWER('%${query}%')
      LIMIT ${limit}
    `

    const results = await executeQuery<SnowflakeCompany>(connection, sqlText)
    console.log("[v0] [Snowflake] Found", results.length, "companies")

    return results
  } catch (error: any) {
    console.error("[v0] [Snowflake] Search error:", error.message)
    throw new Error(`Snowflake search failed: ${error.message}`)
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

// Get company by domain
export async function getSnowflakeCompanyByDomain(domain: string): Promise<SnowflakeCompany | null> {
  let connection: any = null

  try {
    console.log("[v0] [Snowflake] Looking up company by domain:", domain)
    connection = await createConnection()

    const tableName = `${snowflakeConfig.database}.${snowflakeConfig.schema}.${snowflakeConfig.table}`

    const sqlText = `
      SELECT 
        company_id,
        company_name,
        domain,
        website,
        description,
        industry,
        sub_industry,
        employee_count,
        employee_range,
        revenue,
        revenue_range,
        founded_year,
        headquarters_city,
        headquarters_state,
        headquarters_country,
        linkedin_url,
        twitter_url,
        facebook_url,
        technologies,
        keywords,
        phone,
        address
      FROM ${tableName}
      WHERE LOWER(domain) = LOWER('${domain}')
      LIMIT 1
    `

    const results = await executeQuery<SnowflakeCompany>(connection, sqlText)

    if (results.length > 0) {
      console.log("[v0] [Snowflake] Found company:", results[0].company_name)
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

// Advanced search with filters
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
    console.log("[v0] [Snowflake] Advanced search with params:", params)
    connection = await createConnection()

    const tableName = `${snowflakeConfig.database}.${snowflakeConfig.schema}.${snowflakeConfig.table}`

    const conditions: string[] = []

    if (params.query) {
      conditions.push(`(
        LOWER(company_name) LIKE LOWER('%${params.query}%')
        OR LOWER(description) LIKE LOWER('%${params.query}%')
        OR LOWER(keywords) LIKE LOWER('%${params.query}%')
      )`)
    }

    if (params.industry) {
      conditions.push(`LOWER(industry) LIKE LOWER('%${params.industry}%')`)
    }

    if (params.employeeRange) {
      conditions.push(`employee_range = '${params.employeeRange}'`)
    }

    if (params.revenueRange) {
      conditions.push(`revenue_range = '${params.revenueRange}'`)
    }

    if (params.location) {
      conditions.push(`(
        LOWER(headquarters_city) LIKE LOWER('%${params.location}%')
        OR LOWER(headquarters_state) LIKE LOWER('%${params.location}%')
        OR LOWER(headquarters_country) LIKE LOWER('%${params.location}%')
      )`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const limit = params.limit || 50

    const sqlText = `
      SELECT 
        company_id,
        company_name,
        domain,
        website,
        description,
        industry,
        sub_industry,
        employee_count,
        employee_range,
        revenue,
        revenue_range,
        founded_year,
        headquarters_city,
        headquarters_state,
        headquarters_country,
        linkedin_url,
        twitter_url,
        facebook_url,
        technologies,
        keywords,
        phone,
        address
      FROM ${tableName}
      ${whereClause}
      LIMIT ${limit}
    `

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
        }
      })
    }
  }
}

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
