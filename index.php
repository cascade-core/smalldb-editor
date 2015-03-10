<!DOCTYPE html>
<html>
<head lang="en">
	<meta charset="UTF-8">
	<title>SmallDB editor</title>
	<link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/font-awesome/4.2.0/css/font-awesome.min.css" type="text/css">
	<link rel="stylesheet" href="css/smalldb_editor.css" type="text/css">
	<script type="text/javascript" src="https://code.jquery.com/jquery-2.1.1.js"></script>
	<script type="text/javascript" src="js/jquery/gettext.js"></script>
	<script type="text/javascript" src="js/classes/canvas.js"></script>
	<script type="text/javascript" src="js/classes/toolbar.js"></script>
	<script type="text/javascript" src="js/classes/state.js"></script>
	<script type="text/javascript" src="js/classes/placeholder.js"></script>
	<script type="text/javascript" src="js/classes/smalldb_editor.js"></script>
	<script type="text/javascript" src="js/smalldb_editor.js"></script>
	<script type="text/javascript" src="js/init.js"></script>
</head>
<body>

<div style="width: 960px; margin-left: -480px; position: relative; left: 50%;">

	<h1>SmallDB editor</h1>

	<form>
		<textarea style="width: 100%; height: 500px;">
<?php echo file_get_contents(__DIR__ . '/article.json'); ?>
		</textarea>
	</form>

</div>

</body>
</html>