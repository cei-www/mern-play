# Module api: test the Task Manager API with Robot Framework

- Put your tests in `tests/` (`.robot` files) and shared keywords in `resources/` (`.resource` files).
- Run everything from this folder:

      robot --outputdir results tests

- Open the report in the **Preview** tab (port: Robot report) or at http://localhost:9323/report.html
- The API under test is the reference API at http://localhost:3001, with the database `taskapp_test`.
