import { randomUUID } from 'crypto';

export class UniqueEntityID {
  private value: string;

  constructor(id?: string) {
    // Validar formato UUID si se proporciona
    if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error(`Identificador UUID inválido: ${id}`);
    }
    this.value = id || randomUUID();
  }

  public toString(): string {
    return this.value;
  }

  public toValue(): string {
    return this.value;
  }

  public equals(id?: UniqueEntityID): boolean {
    if (id === null || id === undefined) {
      return false;
    }
    if (!(id instanceof UniqueEntityID)) {
      return false;
    }
    return id.toValue() === this.value;
  }
}

export abstract class Entity<T> {
  protected readonly _id: UniqueEntityID;
  public readonly props: T;

  constructor(props: T, id?: UniqueEntityID) {
    this._id = id ? id : new UniqueEntityID();
    this.props = props;
  }

  get id(): UniqueEntityID {
    return this._id;
  }

  public equals(object?: Entity<T>): boolean {
    if (object == null || object == undefined) {
      return false;
    }

    if (this === object) {
      return true;
    }

    if (!(object instanceof Entity)) {
      return false;
    }

    return this._id.equals(object._id);
  }
}

export abstract class ValueObject<T> {
  public readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export interface IdGenerator {
  nextId(): string;
}

export class UUIDGenerator implements IdGenerator {
  nextId(): string {
    return randomUUID();
  }
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DomainError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 409);
  }
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface TransactionManager {
  runInTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
}
export type QueryConnection = any;
