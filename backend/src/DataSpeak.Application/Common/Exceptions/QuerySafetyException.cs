namespace DataSpeak.Application.Common.Exceptions;

public class QuerySafetyException : Exception
{
    public QuerySafetyException(string message)
        : base(message) { }
}
