# @tutorial:begin e-1-template
*** Settings ***
Resource    ../resources/api.resource
Test Template    Title Should Be Rejected

*** Test Cases ***    TITLE
Empty Title    ${EMPTY}
Spaces Only    ${SPACE}${SPACE}
Too Long    ${{'x' * 101}}

*** Keywords ***
Title Should Be Rejected
    [Arguments]    ${title}
    ${body}=    Create Dictionary    title=${title}
    ${response}=    POST    ${BASE_URL}/api/tasks    json=${body}    expected_status=400
    Should Contain    ${response.json()}[error]    title
# @tutorial:end e-1-template
