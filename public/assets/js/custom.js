// Add your custom JS code here
$(document).ready(function () {
    $('#example').DataTable({
        order: [[0, 'asc']],
        paging: false,
    });
});

$(document).ready(function () {
    $('#overallStats').DataTable({
        order: [[0, 'asc']],
        paging: false,
    });
});

$(document).ready(function () {
    $('#lastFifty').DataTable({
        order: [[0, 'asc']],
        paging: false,
    });
});