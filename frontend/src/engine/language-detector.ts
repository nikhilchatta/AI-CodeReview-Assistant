import type { SupportedLanguage } from '../types';

export function detectLanguageFromCode(code: string): SupportedLanguage {
  const lowerCode = code.toLowerCase();

  // Terraform detection - very distinct syntax, check first
  if (lowerCode.includes('resource "') || lowerCode.includes('provider "') ||
      lowerCode.includes('variable "') || lowerCode.includes('terraform {') ||
      lowerCode.includes('module "') || lowerCode.includes('data "')) {
    return 'terraform';
  }

  // Scala detection - check BEFORE SQL because Scala code often contains SQL string literals
  // Look for Scala-specific syntax that Python doesn't have
  const hasScalaSyntax = lowerCode.includes('object ') || lowerCode.includes('case class') ||
      lowerCode.includes('trait ') || lowerCode.includes('extends ') ||
      lowerCode.includes('override def') || lowerCode.includes('implicit ') ||
      lowerCode.includes('sealed ') || lowerCode.includes('match {') ||
      lowerCode.includes('package ') || lowerCode.includes('import org.') ||
      lowerCode.includes('import scala.') || lowerCode.includes('import java.') ||
      (lowerCode.includes('val ') && lowerCode.includes(': ')) ||
      (lowerCode.includes('def ') && lowerCode.includes('): ')) ||
      (lowerCode.includes('def ') && lowerCode.includes(' = {'));

  if (hasScalaSyntax) {
    return 'scala';
  }

  // PySpark detection - Python with Spark (check before generic Python)
  if (lowerCode.includes('pyspark') || lowerCode.includes('from pyspark') ||
      (lowerCode.includes('spark.') && (lowerCode.includes('def ') || lowerCode.includes('import '))) ||
      lowerCode.includes('.createdataframe') ||
      (lowerCode.includes('df.') && (lowerCode.includes('.select(') || lowerCode.includes('.filter(')))) {
    return 'pyspark';
  }

  // Generic Python - check before SQL because Python code might have SQL strings
  if (lowerCode.includes('def ') || lowerCode.includes('import ') ||
      lowerCode.includes('class ') || lowerCode.includes('if __name__') ||
      (lowerCode.includes('from ') && lowerCode.includes('import ')) ||
      lowerCode.includes('print(')) {
    return 'python';
  }

  // SQL detection - check last since other languages often embed SQL strings
  // Require patterns that indicate this is primarily SQL, not just contains SQL keywords
  const sqlPatterns = [
    /^\s*select\s+/im,           // SELECT at start of line
    /^\s*create\s+(table|view|index|database)/im,
    /^\s*insert\s+into/im,
    /^\s*update\s+\w+\s+set/im,
    /^\s*delete\s+from/im,
    /^\s*alter\s+table/im,
    /^\s*drop\s+(table|view|index|database)/im,
    /^\s*with\s+\w+\s+as\s*\(/im,  // CTE
  ];

  if (sqlPatterns.some(pattern => pattern.test(code))) {
    return 'sql';
  }

  return 'python';
}
