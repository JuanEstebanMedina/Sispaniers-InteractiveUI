import {
  deriveBookingStatus,
  deriveOperationStatus,
} from "../../domain/logistics/operation-status.js";
import type { Booking, ContainerState, Operation } from "../../domain/logistics/operation.js";
import type { OperationRepository } from "../../domain/ports/operation.repository.js";

export interface ListedBooking extends Booking {
  status: ContainerState;
}

export interface ListedOperation extends Omit<Operation, "bookings"> {
  status: ContainerState;
  bookings: ListedBooking[];
}

export interface ListOperationsDeps {
  operations: OperationRepository;
}

function listBooking(booking: Booking): ListedBooking {
  return { ...booking, status: deriveBookingStatus(booking) };
}

function listOperation(operation: Operation): ListedOperation {
  return {
    ...operation,
    status: deriveOperationStatus(operation),
    bookings: operation.bookings.map(listBooking),
  };
}

export function createListOperationsUseCase(deps: ListOperationsDeps) {
  return async function listOperations(): Promise<ListedOperation[]> {
    const operations = await deps.operations.findAll();

    return operations.map(listOperation);
  };
}
