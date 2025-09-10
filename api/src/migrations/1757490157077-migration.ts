import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1757490157077 implements MigrationInterface {
    name = 'Migration1757490157077'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "default_commands" ("id" SERIAL NOT NULL, "discord_id" bigint, "name" character varying(100) NOT NULL, "description" text NOT NULL, "cooldown" integer NOT NULL DEFAULT '0', "permissions" bigint NOT NULL DEFAULT '0', "enabled" boolean NOT NULL DEFAULT true, "parent_id" integer, "category_id" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_39b919b01c3f6665d2a89cbe659" UNIQUE ("discord_id"), CONSTRAINT "PK_10f16585571a17d626000e31e98" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_39b919b01c3f6665d2a89cbe65" ON "default_commands" ("discord_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ddac97aaddf0af521c8f9f35dd" ON "default_commands" ("parent_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_12e72383a14a8d6bed3c126056" ON "default_commands" ("name") `);
        await queryRunner.query(`CREATE TABLE "command_categories" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "description" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_074cf814e412dbebe9c07d1fea1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b6ad21c3c7f962758b3ecc49e8" ON "command_categories" ("name") `);
        await queryRunner.query(`ALTER TABLE "default_commands" ADD CONSTRAINT "FK_065fca9c90b89cfcf8694f03252" FOREIGN KEY ("category_id") REFERENCES "command_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "default_commands" ADD CONSTRAINT "FK_ddac97aaddf0af521c8f9f35dd9" FOREIGN KEY ("parent_id") REFERENCES "default_commands"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "default_commands" DROP CONSTRAINT "FK_ddac97aaddf0af521c8f9f35dd9"`);
        await queryRunner.query(`ALTER TABLE "default_commands" DROP CONSTRAINT "FK_065fca9c90b89cfcf8694f03252"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b6ad21c3c7f962758b3ecc49e8"`);
        await queryRunner.query(`DROP TABLE "command_categories"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12e72383a14a8d6bed3c126056"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ddac97aaddf0af521c8f9f35dd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_39b919b01c3f6665d2a89cbe65"`);
        await queryRunner.query(`DROP TABLE "default_commands"`);
    }

}
