*** Settings ***
Library    RequestsLibrary

*** Variables ***
${BASE}    http://localhost:3001

*** Test Cases ***
Health Returns 200
    ${r}=    GET    ${BASE}/api/health
    Should Be Equal As Integers    ${r.status_code}    200

List Tasks Returns 200
    ${r}=    GET    ${BASE}/api/tasks
    Should Be Equal As Integers    ${r.status_code}    200

Create Task Returns 201
    ${body}=    Create Dictionary    title=Robot task
    ${r}=    POST    ${BASE}/api/tasks    json=${body}
    Should Be Equal As Integers    ${r.status_code}    201
