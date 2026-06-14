import { isRouteErrorResponse, useRouteError } from "react-router-dom";

const ErrorPage = () => {
  const error = useRouteError();

  return (
    <>
      <div className="p-5">
        <h1 className="text-2xl font-bold mb-2">Oops</h1>
        <p className="text-foreground">
          {isRouteErrorResponse(error)
            ? "Page doesn't exist"
            : "An unexpected error occurred"}
        </p>
      </div>
    </>
  );
};

export default ErrorPage;
