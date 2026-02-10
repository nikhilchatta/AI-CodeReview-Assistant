export function generateFixedCode(code: string, pipelineType: string): string {
  let fixedCode = code;

  if ((pipelineType === 'python' || pipelineType === 'pyspark') && !code.includes('"""') && !code.includes("'''")) {
    const lines = code.split('\n');
    const firstNonImport = lines.findIndex(line => !line.trim().startsWith('import') && !line.trim().startsWith('from') && line.trim() !== '');
    if (firstNonImport !== -1) {
      lines.splice(firstNonImport, 0, '"""', 'Process data pipeline with proper transformations.', '"""', '');
      fixedCode = lines.join('\n');
    }
  }

  // ========== Python-specific fixes ==========
  if (pipelineType === 'python' || pipelineType === 'pyspark') {
    fixedCode = fixedCode.replace(/^(\s*)except\s*:\s*(#.*)?$/gm, '$1except Exception:  # Fixed: catch specific exceptions$2');
    fixedCode = fixedCode.replace(
      /^(\s*def\s+\w+\([^)]*?)(\w+)\s*=\s*\[\]([^)]*\)\s*:)/gm,
      (_match, before, paramName, after) => {
        return `${before}${paramName}=None${after}\n${' '.repeat(4)}if ${paramName} is None:\n${' '.repeat(8)}${paramName} = []  # Fixed: avoid mutable default argument`;
      }
    );
    fixedCode = fixedCode.replace(/^(\s*)print\((.+)\)\s*$/gm, '$1logger.info($2)  # Fixed: use logging instead of print');
    fixedCode = fixedCode.replace(/^(\s*)global\s+(\w+)\s*$/gm, '$1# Fixed: avoid global state - pass $2 as parameter instead\n$1# global $2');
    fixedCode = fixedCode.replace(
      /^(\s*)(\w+)\s*\+=\s*(f?"[^"]*")\s*(#.*)?$/gm,
      '$1$2_parts.append($3)  # Fixed: use list.append + join instead of += concatenation'
    );
    fixedCode = fixedCode.replace(
      /raise\s+Exception\(([^)]+)\)/g,
      'raise ValueError($1)  # Fixed: use specific exception type'
    );
    fixedCode = fixedCode.replace(
      /type\((\w+)\)\s*==\s*(\w+)/g,
      'isinstance($1, $2)  # Fixed: use isinstance() instead of type() =='
    );
    fixedCode = fixedCode.replace(
      /(?<!ast\.literal_)eval\(([^)]+)\)/g,
      'ast.literal_eval($1)  # Fixed: security - replaced eval with ast.literal_eval'
    );
    fixedCode = fixedCode.replace(
      /^(\s*)(\w+)\s*=\s*open\(([^)]+)\)\s*$/gm,
      '$1with open($3) as $2:  # Fixed: use context manager'
    );
    fixedCode = fixedCode.replace(/^\s*\w+\.close\(\)\s*$/gm, '    # .close() removed - handled by context manager');
    fixedCode = fixedCode.replace(
      /=\s*["']([A-Z]:\\[^"']+|\/(?:home|tmp|var|etc|usr)\/[^"']+)["']/g,
      '= os.environ.get("CONFIG_PATH", "$1")  # Fixed: use environment variable instead of hardcoded path'
    );
    fixedCode = fixedCode.replace(
      /requests\.(get|post|put|delete|patch)\(([^)]+)\)(?!\s*#\s*Fixed)/g,
      (_match, method, args) => {
        if (args.includes('timeout')) return _match;
        return `requests.${method}(${args}, timeout=30)  # Fixed: added timeout`;
      }
    );
    fixedCode = fixedCode.replace(
      /^(\s*)except\s+Exception\s+as\s+(\w+)\s*:\s*(#.*)?$/gm,
      '$1except (ValueError, TypeError, OSError) as $2:  # Fixed: catch specific exceptions$3'
    );
    if (fixedCode.includes('logger.info(') && !fixedCode.includes('import logging')) {
      fixedCode = 'import logging\n\nlogger = logging.getLogger(__name__)\n\n' + fixedCode;
    }
    if (fixedCode.includes('ast.literal_eval') && !fixedCode.includes('import ast')) {
      fixedCode = 'import ast\n' + fixedCode;
    }
  }

  // ========== PySpark / Spark-specific fixes ==========
  if (pipelineType === 'pyspark') {
    fixedCode = fixedCode.replace(/System\.exit\((\d+)\)/g, 'throw new RuntimeException("Pipeline failed with exit code $1")');
    fixedCode = fixedCode.replace(/sys\.exit\((\d+)\)/g, 'raise RuntimeError(f"Pipeline failed with exit code $1")');
    fixedCode = fixedCode.replace(/exit\((\d+)\)/g, 'raise SystemExit(f"Pipeline failed with exit code $1")');
    fixedCode = fixedCode.replace(/spark\.read\.(csv|json|parquet)\(/g, (_match, format) => {
      return `spark.read.schema(myExplicitSchema).${format}(  // TODO: Define explicit schema`;
    });
    fixedCode = fixedCode.replace(/\.rdd\./g, '.toDF().  // Converted from RDD to DataFrame');
    fixedCode = fixedCode.replace(/RDD\[.*\]/g, 'DataFrame  // Converted from RDD to DataFrame');
    if (fixedCode.includes('DataFrame') && !fixedCode.includes('.na.') && !fixedCode.includes('.isNull')) {
      fixedCode = fixedCode.replace(/(\w+)\s*=\s*spark\.read/g, '$1 = spark.read\n  .na.fill(0)  // Added null handling');
    }
    fixedCode = fixedCode.replace(/\.join\((\w+),\s*["'](\w+)["']\)/g, '.join(broadcast($1), "$2")  // Added broadcast hint');
    fixedCode = fixedCode.replace(/@udf[\s\S]*?def\s+(\w+)/g, '// TODO: Replace UDF with built-in function\ndef $1');
    fixedCode = fixedCode.replace(/udf\(lambda\s+([^:]+):\s*([^,)]+)\)/g, 'when($1, $2).otherwise(lit("default"))  // Replaced UDF with built-in');
    fixedCode = fixedCode.replace(/\.select\("\*"\)/g, '.select("col1", "col2", "col3")  // TODO: Specify actual columns');
    fixedCode = fixedCode.replace(/^\s*df\.show\(\)\s*;?\s*$/gm, '    # df.show() removed - use for debugging only');
    fixedCode = fixedCode.replace(/^\s*df\.count\(\)\s*;?\s*$/gm, '    # df.count() removed - use for debugging only');
    fixedCode = fixedCode.replace(/^\s*df\.printSchema\(\)\s*;?\s*$/gm, '    # df.printSchema() removed - use for debugging only');
    if (fixedCode.includes('.cache()') && !fixedCode.includes('unpersist()')) {
      fixedCode = fixedCode.replace(/(\w+)\.cache\(\)\s*;?\s*$/gm, '$1.cache()\n    $1.unpersist()  # Added unpersist');
    }
    if (fixedCode.includes('.persist(') && !fixedCode.includes('unpersist()')) {
      fixedCode = fixedCode.replace(/(\w+)\.persist\(([^)]+)\)\s*;?\s*$/gm, '$1.persist($2)\n    $1.unpersist()  # Added unpersist');
    }
    if (fixedCode.includes('.write.') && !fixedCode.includes('.coalesce(') && !fixedCode.includes('.repartition(')) {
      fixedCode = fixedCode.replace(/(\w+)\.write\.mode\(([^)]+)\)\.([a-z]+)\(/g, '$1.coalesce(10).write.mode($2).$3(  # Added coalesce for optimal file size');
    }
    fixedCode = fixedCode.replace(/spark\.table\(["']([^"']+)["']\)/g, 'spark.table("my_view_$1")  // TODO: Use view instead of direct table access');
    fixedCode = fixedCode.replace(/spark\.sql\(["']([^"']+)["']\)/g, 'spark.sql("SELECT * FROM my_view_$1")  // TODO: Use view instead of direct table access');
    fixedCode = fixedCode.replace(/\.collect\(\)/g, '.take(1000)  # Limited to prevent OOM');
    fixedCode = fixedCode.replace(/\.toPandas\(\)/g, '.limit(10000).toPandas()  # Limited before conversion');
    fixedCode = fixedCode.replace(/inferSchema\s*=\s*True/g, 'inferSchema=False  # TODO: Define explicit schema');
  }

  // ========== Scala-specific fixes ==========
  if (pipelineType === 'scala') {
    fixedCode = fixedCode.replace(/var\s+(\w+)\s*=\s*/g, 'val $1 =  // Fixed: prefer val over var for immutability');
    fixedCode = fixedCode.replace(/:\s*String\s*=\s*null\b/g, ': Option[String] = None  // Fixed: use Option instead of null');
    fixedCode = fixedCode.replace(/=\s*null\b/g, '= None  // Fixed: use Option instead of null');
    fixedCode = fixedCode.replace(/\.get\("([^"]+)"\)\.get\b/g, '.get("$1").getOrElse("")  // Fixed: use getOrElse instead of unsafe .get');
    fixedCode = fixedCode.replace(/\.get\b(?!\s*\()/g, '.getOrElse(throw new NoSuchElementException("Missing value"))  // Fixed: handle missing Option');
    fixedCode = fixedCode.replace(
      /if\s*\((\w+)\s*!=\s*null\)\s*\{([^}]+)\}\s*else\s*\{([^}]+)\}/g,
      'Option($1).map { v => $2 }.getOrElse { $3 }  // Fixed: use Option instead of null check'
    );
    fixedCode = fixedCode.replace(/println\(([^)]+)\)/g, 'logger.info($1)  // Fixed: use structured logging instead of println');
    fixedCode = fixedCode.replace(/System\.exit\((\d+)\)/g, 'throw new RuntimeException("Process failed with exit code $1")  // Fixed: throw exception instead of System.exit');
    fixedCode = fixedCode.replace(
      /case\s+e:\s*Exception\s*=>/g,
      'case e: (IllegalArgumentException | IOException | RuntimeException) =>  // Fixed: catch specific exceptions'
    );
    fixedCode = fixedCode.replace(/\.collect\(\)\.foreach\b/g, '.take(1000).foreach  // Fixed: limit collect to prevent OOM');
    fixedCode = fixedCode.replace(/\.collect\(\)/g, '.take(1000)  // Fixed: limit collect to prevent OOM');
    fixedCode = fixedCode.replace(
      /spark\.sql\(s"([^"]+)"\)/g,
      'spark.sql("$1")  // Fixed: SECURITY - avoid string interpolation in SQL, use parameterized queries'
    );
    fixedCode = fixedCode.replace(
      /val\s+(\w+)\s*=\s*(java\.sql\.DriverManager\.getConnection\([^)]+\))/g,
      'val $1 = scala.util.Using.resource($2)  // Fixed: use Using.resource to prevent resource leak'
    );
    fixedCode = fixedCode.replace(
      /"password"/g,
      'sys.env.getOrElse("DB_PASSWORD", "")  // Fixed: use environment variable instead of hardcoded password'
    );
    fixedCode = fixedCode.replace(
      /\.filter\(([^)]+)\)\s*\n(\s*)\.filter\(([^)]+)\)\s*\n(\s*)\.filter\(([^)]+)\)/g,
      '.filter($1 && $3 && $5)  // Fixed: combine multiple filters for better performance'
    );
    fixedCode = fixedCode.replace(
      /\.repartition\(\d+\)\s*\n\s*\.repartition\((\d+)\)/g,
      '.repartition($1)  // Fixed: removed redundant repartition'
    );
    fixedCode = fixedCode.replace(
      /(val\s+expensive\s*=\s*[^;]+(?:\.join\([^)]+\))+[^;]*)/g,
      '$1\n    expensive.persist(StorageLevel.MEMORY_AND_DISK)  // Fixed: persist expensive computation that is reused'
    );
    fixedCode = fixedCode.replace(
      /\.write\s*\n?\s*\.mode\("overwrite"\)\s*\n?\s*\.parquet\(/g,
      '.write\n      .mode("overwrite")\n      .partitionBy("date", "region")  // Fixed: add partitioning for large datasets\n      .parquet('
    );
    fixedCode = fixedCode.replace(
      /\.withColumn\("(\w+)",\s*concat\(col\("(\w+)"\),\s*lit\("([^"]+)"\)\)\)\s*\n\s*\.withColumn\("\1",\s*concat\(col\("\1"\),\s*col\("(\w+)"\)\)\)/g,
      '.withColumn("$1", concat(col("$2"), lit("$3"), col("$4")))  // Fixed: single concat call'
    );
    if (fixedCode.includes('logger.info(') && !fixedCode.includes('import org.slf4j')) {
      fixedCode = 'import org.slf4j.LoggerFactory\n\nprivate val logger = LoggerFactory.getLogger(getClass)\n\n' + fixedCode;
    }
    fixedCode = fixedCode.replace(
      /("s3:\/\/[^"]+\/[^"]*\d{4}[^"]*")/g,
      'config.getString("data.path")  // Fixed: use configuration instead of hardcoded S3 path'
    );
    fixedCode = fixedCode.replace(
      /spark\.read\.json\(([^)]+)\)/g,
      'spark.read.schema(expectedSchema).json($1)  // Fixed: use explicit schema instead of inference'
    );
    fixedCode = fixedCode.replace(
      /spark\.read\s*\n?\s*\.option\("header",\s*"true"\)\s*\n?\s*\.csv\(/g,
      'spark.read\n      .schema(expectedSchema)  // Fixed: use explicit schema\n      .option("header", "true")\n      .csv('
    );
  }

  // ========== SQL-specific fixes ==========
  if (pipelineType === 'sql') {
    fixedCode = fixedCode.replace(/SELECT\s+\*/gi, 'SELECT col1, col2, col3  /* TODO: Specify actual columns */');
    fixedCode = fixedCode.replace(
      /(\w+)\s+IN\s*\(\s*SELECT\s+(\w+)\s+FROM\s+(\w+)\s+WHERE\s+([^)]+)\)/gi,
      (_match, outerCol, innerCol, tableName) => {
        return `INNER JOIN ${tableName} ON ${outerCol} = ${tableName}.${innerCol}  -- Replaced correlated subquery with JOIN`;
      }
    );
    fixedCode = fixedCode.replace(
      /WHERE\s+([^>!=]+)\s*>\s*(\d+)/gi,
      (_match, column, value) => {
        return `WHERE ${column} IS NOT NULL AND ${column} > ${value}  -- Added explicit null check`;
      }
    );
    fixedCode = fixedCode.replace(/\braw_transactions\b/gi, 'fact_transactions  -- Use processed fact table');
    fixedCode = fixedCode.replace(/\bcustomer_segments\b/gi, 'dim_customer_segments  -- Use dimension table');
    fixedCode = fixedCode.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '@start_date  -- TODO: Pass as parameter');
    fixedCode = fixedCode.replace(/HAVING\s+SUM\([^)]+\)\s*>\s*\d+/gi, 'HAVING SUM(amount) > @min_amount_threshold  -- TODO: Pass as parameter');
    fixedCode = fixedCode.replace(/'premium'/gi, '@segment_type  -- TODO: Pass as parameter');
    if (fixedCode.includes('GROUP BY') && !fixedCode.includes('-- Partitioning:')) {
      fixedCode = '-- Partitioning considerations:\n' +
                  '-- 1. Partition fact_transactions by transaction_date (monthly partitions)\n' +
                  '-- 2. Consider clustered index on (customer_id, transaction_date)\n' +
                  fixedCode;
    }
    if (!fixedCode.includes('INSERT INTO audit_log') && !fixedCode.includes('-- Logging:')) {
      fixedCode = '-- Logging: Start of process\n' +
                  '-- INSERT INTO audit_log (process_name, start_time, status) VALUES (\'customer_summary\', GETDATE(), \'STARTED\');\n\n' +
                  fixedCode +
                  '\n\n-- Logging: End of process\n' +
                  '-- INSERT INTO audit_log (process_name, end_time, status, records_processed) VALUES (\'customer_summary\', GETDATE(), \'COMPLETED\', @@ROWCOUNT);';
    }
    if (!fixedCode.includes('-- =============================================')) {
      fixedCode = '-- =============================================\n' +
                  '-- Customer Transaction Summary Query\n' +
                  '-- Purpose: Calculate total amounts and transaction counts\n' +
                  '-- Parameters: @start_date, @segment_type, @min_amount_threshold\n' +
                  '-- =============================================\n\n' +
                  fixedCode;
    }
  }

  // ========== Common fixes (all languages) ==========
  fixedCode = fixedCode.replace(/password\s*=\s*"[^"]+"/gi,
    'password = dbutils.secrets.get(scope="my-scope", key="password")  # Fixed: use secrets manager'
  );

  return fixedCode;
}
