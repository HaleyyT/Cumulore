SET LOCAL ROLE cumulore_migration;

ALTER TYPE source_format ADD VALUE IF NOT EXISTS 'docx';
ALTER TYPE source_format ADD VALUE IF NOT EXISTS 'pptx';

RESET ROLE;
