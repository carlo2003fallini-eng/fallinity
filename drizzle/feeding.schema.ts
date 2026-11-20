import { sql } from "drizzle-orm";
import {
  mysqlTable,
  varchar,
  text,
  int,
  bigint,
  json,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import type {
  FeedRecipe,
  FeedRun,
  FeedDistribution,
  FeedLeftover,
  FeedNir,
  FeedContainer,
  FeedSetting,
  FeedComparison,
  MilkRecord,
} from "../shared/feeding/types";
const audit = () => ({
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: varchar("createdBy", { length: 36 }),
  updatedBy: varchar("updatedBy", { length: 36 }),
  deletedAt: timestamp("deletedAt"),
  deletedBy: varchar("deletedBy", { length: 36 }),
});
const identity = () => ({
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("companyId", { length: 36 }).notNull(),
});
export const feedingRecipes = mysqlTable(
  "feedingRecipes",
  {
    ...identity(),
    groupId: varchar("groupId", { length: 36 }).notNull(),
    rootId: varchar("rootId", { length: 36 }).notNull(),
    version: int("version").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    validFrom: bigint("validFrom", { mode: "number" }),
    payload: json("payload").$type<FeedRecipe>().notNull(),
    ...audit(),
  },
  t => [
    index("feeding_recipe_company_group").on(t.companyId, t.groupId),
    uniqueIndex("feeding_recipe_version").on(t.companyId, t.rootId, t.version),
  ]
);
export const feedingRuns = mysqlTable(
  "feedingRuns",
  {
    ...identity(),
    groupId: varchar("groupId", { length: 36 }).notNull(),
    recipeId: varchar("recipeId", { length: 36 }).notNull(),
    requestKey: varchar("requestKey", { length: 100 }).notNull(),
    state: varchar("state", { length: 20 }).notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    payload: json("payload").$type<FeedRun>().notNull(),
    ...audit(),
  },
  t => [
    uniqueIndex("feeding_run_request").on(t.companyId, t.requestKey),
    index("feeding_run_company_at").on(t.companyId, t.at),
  ]
);
export const feedingDistributions = mysqlTable(
  "feedingDistributions",
  {
    ...identity(),
    runId: varchar("runId", { length: 36 }).notNull(),
    groupId: varchar("groupId", { length: 36 }).notNull(),
    requestKey: varchar("requestKey", { length: 100 }).notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    payload: json("payload").$type<FeedDistribution>().notNull(),
    ...audit(),
  },
  t => [
    uniqueIndex("feeding_distribution_request").on(t.companyId, t.requestKey),
    index("feeding_distribution_group_at").on(t.companyId, t.groupId, t.at),
  ]
);
export const feedingLeftovers = mysqlTable(
  "feedingLeftovers",
  {
    ...identity(),
    distributionId: varchar("distributionId", { length: 36 }).notNull(),
    groupId: varchar("groupId", { length: 36 }).notNull(),
    requestKey: varchar("requestKey", { length: 100 }).notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    payload: json("payload").$type<FeedLeftover>().notNull(),
    ...audit(),
  },
  t => [
    uniqueIndex("feeding_leftover_request").on(t.companyId, t.requestKey),
    uniqueIndex("feeding_leftover_distribution").on(
      t.companyId,
      t.distributionId
    ),
  ]
);
export const feedingNirAnalyses = mysqlTable(
  "feedingNirAnalyses",
  {
    ...identity(),
    productId: varchar("productId", { length: 36 }).notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    payload: json("payload").$type<FeedNir>().notNull(),
    ...audit(),
  },
  t => [index("feeding_nir_product_at").on(t.companyId, t.productId, t.at)]
);
export const feedingContainers = mysqlTable("feedingContainers", {
  ...identity(),
  payload: json("payload").$type<FeedContainer>().notNull(),
  ...audit(),
});
export const feedingSettings = mysqlTable(
  "feedingSettings",
  {
    ...identity(),
    scopeType: varchar("scopeType", { length: 20 }).notNull(),
    scopeId: varchar("scopeId", { length: 80 }).notNull(),
    payload: json("payload").$type<FeedSetting>().notNull(),
    ...audit(),
  },
  t => [
    uniqueIndex("feeding_setting_scope").on(
      t.companyId,
      t.scopeType,
      t.scopeId
    ),
  ]
);
export const feedingComparisons = mysqlTable("feedingComparisons", {
  ...identity(),
  at: bigint("at", { mode: "number" }).notNull(),
  payload: json("payload").$type<FeedComparison>().notNull(),
  ...audit(),
});
export const datiStallaRilevazioni = mysqlTable(
  "datiStallaRilevazioni",
  {
    ...identity(),
    groupId: varchar("groupId", { length: 36 }).notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    payload: json("payload").$type<MilkRecord>().notNull(),
    ...audit(),
  },
  t => [uniqueIndex("dati_stalla_group_at").on(t.companyId, t.groupId, t.at)]
);
export const feedingCorrections = mysqlTable(
  "feedingCorrections",
  {
    ...identity(),
    runId: varchar("runId", { length: 36 }).notNull(),
    requestKey: varchar("requestKey", { length: 100 }).notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    payload: json("payload").notNull(),
    ...audit(),
  },
  t => [uniqueIndex("feeding_correction_request").on(t.companyId, t.requestKey)]
);
