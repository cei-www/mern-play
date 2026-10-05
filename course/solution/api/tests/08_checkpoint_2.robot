# @tutorial:begin cp2-ex3-test
*** Settings ***
Resource    ../resources/api.resource
Suite Setup    Connect To Test Database
Suite Teardown    Disconnect From All Databases
Test Teardown    Delete Test Tasks

*** Test Cases ***
Api And Database Agree On The Task Count
    Task Count Should Match Database
# @tutorial:end cp2-ex3-test

# @tutorial:begin cp2-ex4-delete
Deleted Task Is Gone
    ${id}=    Create Task    Robot delete me
    ${first}=    DELETE    ${BASE_URL}/api/tasks/${id}
    Should Be Equal As Integers    ${first.status_code}    204
    ${second}=    DELETE    ${BASE_URL}/api/tasks/${id}    expected_status=404
    ${read}=    GET    ${BASE_URL}/api/tasks/${id}    expected_status=404
# @tutorial:end cp2-ex4-delete
