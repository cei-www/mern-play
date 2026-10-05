# @tutorial:begin d-5-clean-tests
*** Settings ***
Resource    ../resources/api.resource
Suite Setup    Connect To Test Database
Suite Teardown    Disconnect From All Databases
Test Teardown    Delete Test Tasks

*** Test Cases ***
New Task Is Stored
    ${id}=    Create Task    Robot clean task    priority=${3}
    Task Should Exist    ${id}

Done Task Has A Completion Time
    ${id}=    Create Task    Robot clean done
    Mark Task Done    ${id}
    Completed At Should Be Set    ${id}
# @tutorial:end d-5-clean-tests
