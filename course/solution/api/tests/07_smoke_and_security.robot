# @tutorial:begin e-2-tags
*** Settings ***
Resource    ../resources/api.resource
Test Tags    regression

*** Test Cases ***
Health Is Up
    [Tags]    smoke
    ${response}=    GET    ${BASE_URL}/api/health
    Should Be Equal As Integers    ${response.status_code}    200

Task List Is Not Empty
    [Tags]    smoke
    ${response}=    GET    ${BASE_URL}/api/tasks
    Should Not Be Empty    ${response.json()}

Open Tasks Filter Works
    ${response}=    GET    ${BASE_URL}/api/tasks    params=done=0
    Should Be Equal As Integers    ${response.status_code}    200
# @tutorial:end e-2-tags

# @tutorial:begin e-3-unsafe-sort
Unsafe Sort Value Is Rejected
    ${response}=    GET    ${BASE_URL}/api/tasks    params=sort=title;drop    expected_status=400
    Should Contain    ${response.json()}[error]    sort
# @tutorial:end e-3-unsafe-sort
