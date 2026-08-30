import type { Collection, Db } from "mongodb";
import type { LayoutBreakpoint, OperationLayout } from "../../../../domain/components/layout.js";
import type { OperationLayoutRepository } from "../../../../domain/ports/operation-layout.repository.js";
import {
  type OperationLayoutDocument,
  toOperationLayout,
  toOperationLayoutDocument,
} from "./operation-layout.mapper.js";

const COLLECTION_NAME = "operation_layouts";

export class MongoOperationLayoutRepository implements OperationLayoutRepository {
  private readonly layouts: Collection<OperationLayoutDocument>;

  constructor(db: Db) {
    this.layouts = db.collection<OperationLayoutDocument>(COLLECTION_NAME);
  }

  async findByOperationId(operationId: string): Promise<OperationLayout | null> {
    const document = await this.layouts.findOne({ _id: operationId });

    return document === null ? null : toOperationLayout(document);
  }

  async saveBreakpoint(operationId: string, breakpoint: LayoutBreakpoint): Promise<void> {
    const existing = await this.layouts.findOne({ _id: operationId });
    const otherBreakpoints = (existing?.breakpoints ?? []).filter(
      (entry) => entry.cols !== breakpoint.cols,
    );

    const next = toOperationLayoutDocument({
      operationId,
      breakpoints: [...otherBreakpoints, breakpoint],
    });

    // ponytail: read-modify-write race on concurrent PATCH; upgrade to arrayFilters update if
    // multi-tab concurrent editing becomes real.
    await this.layouts.replaceOne({ _id: operationId }, next, { upsert: true });
  }
}
