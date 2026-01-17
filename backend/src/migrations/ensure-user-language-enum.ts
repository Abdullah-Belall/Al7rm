import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureUserLanguageEnum1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if enum exists, if not create it
    const enumExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'user_language'
      );
    `);

    if (!enumExists[0].exists) {
      await queryRunner.query(`
        CREATE TYPE "user_language" AS ENUM ('ar', 'en', 'fr', 'fa', 'hi');
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Don't drop enum as it might be used by other tables
    // If you need to drop it, make sure to drop all columns using it first
  }
}

