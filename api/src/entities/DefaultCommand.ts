import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import type { CommandCategory } from "./CommandCategory";

@Entity("default_commands")
@Index(["name"])
@Index(["parentId"])
@Index(["discordId"])
export class DefaultCommand {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "discord_id", type: "bigint", nullable: true, unique: true })
  discordId!: string | null;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "integer", default: 0 })
  cooldown!: number;

  @Column({ type: "bigint", default: 0 })
  permissions!: string;

  @Column({ type: "boolean", default: true })
  enabled!: boolean;

  @Column({ name: "parent_id", type: "integer", nullable: true })
  parentId!: number | null;

  @Column({ name: "category_id", type: "integer", nullable: true })
  categoryId!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // Relations
  @ManyToOne("CommandCategory", "commands", {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "category_id" })
  category!: CommandCategory | null;

  @ManyToOne("DefaultCommand", "subcommands", {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "parent_id" })
  parent!: DefaultCommand | null;

  @OneToMany("DefaultCommand", "parent")
  subcommands!: DefaultCommand[];
}
