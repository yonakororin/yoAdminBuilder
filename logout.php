<?php
session_start();
session_destroy();
header("Location: builder.php"); // Will redirect to SSO
exit;
?>
