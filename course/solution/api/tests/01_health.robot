# @tutorial:begin a-3-first-test
*** Settings ***
Library    RequestsLibrary

*** Variables ***
${BASE_URL}    http://localhost:3001

*** Test Cases ***
Health Returns 200
    ${response}=    GET    ${BASE_URL}/api/health
    Should Be Equal As Integers    ${response.status_code}    200
# @tutorial:end a-3-first-test

# @tutorial:begin a-5-body-test
Health Body Says Ok
    ${response}=    GET    ${BASE_URL}/api/health
    Should Be Equal    ${response.json()}[status]    ok
# @tutorial:end a-5-body-test
