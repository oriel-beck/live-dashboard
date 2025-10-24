import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFilePathToDefaultCommands1760273363033 implements MigrationInterface {
    name = 'AddFilePathToDefaultCommands1760273363033'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "default_commands" DROP CONSTRAINT "FK_065fca9c90b89cfcf8694f03252"`);
        await queryRunner.query(`ALTER TABLE "default_commands" ADD "file_path" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "default_commands" ADD CONSTRAINT "FK_065fca9c90b89cfcf8694f03252" FOREIGN KEY ("category_id") REFERENCES "command_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "default_commands" DROP CONSTRAINT "FK_065fca9c90b89cfcf8694f03252"`);
        await queryRunner.query(`ALTER TABLE "default_commands" DROP COLUMN "file_path"`);
        await queryRunner.query(`ALTER TABLE "default_commands" ADD CONSTRAINT "FK_065fca9c90b89cfcf8694f03252" FOREIGN KEY ("category_id") REFERENCES "command_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
