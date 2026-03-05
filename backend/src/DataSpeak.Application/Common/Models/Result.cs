namespace DataSpeak.Application.Common.Models;

/// <summary>
/// Discriminated union for operation results.
/// Avoids throwing exceptions for expected business failures.
/// </summary>
public class Result<T>
{
    public bool IsSuccess { get; private init; }
    public T? Value { get; private init; }
    public string? Error { get; private init; }
    public string? ErrorCode { get; private init; }

    private Result() { }

    public static Result<T> Success(T value) =>
        new() { IsSuccess = true, Value = value };

    public static Result<T> Failure(string error, string? errorCode = null) =>
        new() { IsSuccess = false, Error = error, ErrorCode = errorCode };

    public TOut Match<TOut>(Func<T, TOut> onSuccess, Func<string, TOut> onFailure) =>
        IsSuccess ? onSuccess(Value!) : onFailure(Error!);
}

public class Result
{
    public bool IsSuccess { get; private init; }
    public string? Error { get; private init; }
    public string? ErrorCode { get; private init; }

    private Result() { }

    public static Result Success() => new() { IsSuccess = true };

    public static Result Failure(string error, string? errorCode = null) =>
        new() { IsSuccess = false, Error = error, ErrorCode = errorCode };
}
