import { Issue, Severity } from "../types";

interface Rule {
  id: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
  suggestion?: string;
}

const RULES: Rule[] = [
  {
    id: "DROP_TABLE",
    severity: "CRITICAL",
    pattern: /\bDROP\s+TABLE\b/i,
    message: "DROP TABLE bersifat irreversible — semua data akan hilang permanen.",
    suggestion: "Gunakan soft-delete atau rename tabel sebelum drop di migration berikutnya.",
  },
  {
    id: "DROP_COLUMN",
    severity: "CRITICAL",
    pattern: /\bDROP\s+COLUMN\b/i,
    message: "DROP COLUMN bersifat irreversible — data kolom akan hilang permanen.",
    suggestion: "Pastikan aplikasi sudah tidak mengakses kolom ini sebelum drop.",
  },
  {
    id: "TRUNCATE",
    severity: "CRITICAL",
    pattern: /\bTRUNCATE\b/i,
    message: "TRUNCATE akan menghapus semua data dalam tabel.",
    suggestion: "Jangan jalankan TRUNCATE di production kecuali disengaja.",
  },
  {
    id: "DELETE_WITHOUT_WHERE",
    severity: "CRITICAL",
    pattern: /\bDELETE\s+FROM\s+\S+\s*(?:;|$)/i,
    message: "DELETE tanpa WHERE akan menghapus semua baris dalam tabel.",
    suggestion: "Tambahkan klausa WHERE untuk membatasi baris yang dihapus.",
  },
  {
    id: "UPDATE_WITHOUT_WHERE",
    severity: "HIGH",
    pattern: /\bUPDATE\s+\S+\s+SET\b(?![\s\S]*\bWHERE\b)/i,
    message: "UPDATE tanpa WHERE akan mengubah semua baris dalam tabel.",
    suggestion: "Tambahkan klausa WHERE untuk membatasi baris yang diupdate.",
  },
  {
    id: "RENAME_TABLE",
    severity: "HIGH",
    pattern: /\bRENAME\s+TABLE\b|\bALTER\s+TABLE\s+\S+\s+RENAME\s+TO\b/i,
    message: "RENAME TABLE adalah breaking change — query yang menggunakan nama lama akan gagal.",
    suggestion: "Buat view dengan nama lama, atau pastikan semua referensi sudah diupdate.",
  },
  {
    id: "RENAME_COLUMN",
    severity: "HIGH",
    pattern: /\bRENAME\s+COLUMN\b/i,
    message: "RENAME COLUMN adalah breaking change — query yang menggunakan nama lama akan gagal.",
    suggestion: "Tambahkan kolom baru, migrate data, lalu hapus kolom lama di migration terpisah.",
  },
  {
    id: "ADD_NOT_NULL_WITHOUT_DEFAULT",
    severity: "HIGH",
    pattern: /\bADD\s+COLUMN\s+\S+\s+\S+.*\bNOT\s+NULL\b(?![\s\S]*\bDEFAULT\b)/i,
    message: "ADD COLUMN NOT NULL tanpa DEFAULT akan gagal jika tabel sudah berisi data.",
    suggestion: "Gunakan 3-step: (1) ADD COLUMN nullable, (2) backfill data, (3) SET NOT NULL.",
  },
  {
    id: "ALTER_COLUMN_TYPE",
    severity: "HIGH",
    pattern: /\bALTER\s+COLUMN\s+\S+\s+(?:TYPE|SET\s+DATA\s+TYPE)\b/i,
    message: "ALTER COLUMN TYPE bisa gagal jika ada data yang tidak bisa di-cast.",
    suggestion: "Tambahkan USING clause atau lakukan migration data secara manual terlebih dahulu.",
  },
  {
    id: "CREATE_INDEX_WITHOUT_CONCURRENTLY",
    severity: "MEDIUM",
    pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+CONCURRENTLY)/i,
    message: "CREATE INDEX tanpa CONCURRENTLY akan lock tabel dan memblokir read/write.",
    suggestion: "Gunakan CREATE INDEX CONCURRENTLY untuk menghindari table lock di production.",
  },
  {
    id: "DROP_INDEX",
    severity: "MEDIUM",
    pattern: /\bDROP\s+INDEX\b/i,
    message: "DROP INDEX bisa mempengaruhi performa query yang bergantung pada index ini.",
    suggestion: "Pastikan tidak ada query kritis yang menggunakan index ini.",
  },
  {
    id: "DROP_CONSTRAINT",
    severity: "MEDIUM",
    pattern: /\bDROP\s+CONSTRAINT\b/i,
    message: "DROP CONSTRAINT menghilangkan validasi data — bisa mengakibatkan data kotor.",
    suggestion: "Pastikan aplikasi sudah handle validasi di level aplikasi sebelum drop constraint.",
  },
];

export function checkStatement(
  statement: string,
  lineNumber: number,
  file: string
): Issue[] {
  const issues: Issue[] = [];
  const trimmed = statement.trim();
  if (!trimmed) return issues;

  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) {
      issues.push({
        severity: rule.severity,
        file,
        line: lineNumber,
        statement: trimmed.split("\n")[0].substring(0, 120),
        message: rule.message,
        suggestion: rule.suggestion,
      });
    }
  }

  return issues;
}
