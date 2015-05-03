<?php

$path = __DIR__ . '/api/*.html';
$ignore = ['.js.html', 'index'];
$files = glob($path);

foreach ($files as $file) {
	$cont = TRUE;
	foreach ($ignore as $ig) {
		if (strpos($file, $ig) !== FALSE) {
			$cont = FALSE;
		}
	}
	if ($cont) {
		$content = file_get_contents($file);
		$lines = explode(PHP_EOL, $content);
		$lines = array_slice($lines, 19, -20);
		$lines = array_filter($lines, function($item) {
			return trim($item);
		});
		$content = implode(PHP_EOL, $lines);
		$content = str_replace('<span class="signature-attributes">opt</span>', '_{opt}', $content);

		// headings
		$content = preg_replace_callback('~\<h1(.*)\/h1\>~s', function($m) {
			return '\section{' . trim(strip_tags($m[0])) . '}';
		}, $content);
		$content = preg_replace_callback('~\<h2(.*)\/h2\>~s', function($m) {
			return '';
			return '\subsection{' . trim(strip_tags($m[0])) . '}';
		}, $content);
		$content = preg_replace_callback('~\<h3(.*)\/h3\>~', function($m) {
			return '\subsection*{' . trim(strip_tags($m[0])) . '}';
			return '\subsubsection{' . trim(strip_tags($m[0])) . '}';
		}, $content);
		$content = preg_replace_callback('~\<h4(.*)\/h4\>~', function($m) {
			return '\paragraph{' . trim(strip_tags($m[0])) . '}';
		}, $content);
		$content = preg_replace_callback('~\<h5(.*)\/h5\>~', function($m) {
			return ''; // ignore parameters and returns heading
			return '\paragraph{' . trim(strip_tags($m[0])) . '}';
		}, $content);
		$content = preg_replace_callback('~\<table(.*?)\/table\>~s', function($m) {
			return ''; // ignore tables
			$ret = "\\begin{table}[ht]\n\\begin{tabular}{";

			$dom = new DOMDocument;
			$dom->loadHTML($m[0]);
			$cols = $dom->getElementsByTagName('th');
			$ret .= '|' . str_repeat('l|', $cols->length) . "}\n";
			$rows = $dom->getElementsByTagName('tr');
			foreach ($rows as $row) {
				$ret .= "\\hline\n";
				foreach ($row->childNodes as $col) {
					if (isset($col->tagName)) {
						$ret .= trim($col->nodeValue) . ' [[amp]] ';
					}
				}
				$ret = substr($ret, 0, -8) . "\\\\\n";
			}
			$ret .= "\\hline\n";
//			\texttt{<code>}

			return $ret . "\\end{tabular}\n\\end{table}";
		}, $content);
		$content = preg_replace_callback('~\<dl(.*?)\/dl\>~s', function($m) {
			return ''; // ignore return types
			$ret = "\\begin{description}\n";
			$lines = explode(PHP_EOL, $m[0]);
			$lines = array_slice($lines, 1, -1);
			for ($i = 0; $i < count($lines); $i += 2) {
				$l = trim(strip_tags($lines[$i]));
				if (!$l || in_array($l, ['Copyright:', 'Source:', 'To Do:'])) {
					if ($l === 'Source:') {
						$i += 2;
					}
					continue;
				}
				$v = trim(strip_tags($lines[$i + 1]));
				$ret .= "\\item[$l] $v\n";
			}

			return $ret . "\\end{description}\n";
		}, $content);

		$content = str_replace(' , ', ', ', $content);
		$content = strip_tags($content);
		$content = html_entity_decode($content);
		$content = strtr($content, [
			"\\begin{description}\n\\end{description}\n" => '',
			'$' => '\$',
			'&' => '\&',
			'[[amp]]' => '&',
			'_' => '\_',
			'#' => '\#',
		]);
		$content = strtr($content, [
			'\\_{opt}' => '$_{\text{opt}}$',
//			'{' => '\{',
//			'}' => '\}',
		]);
		$lines = explode(PHP_EOL, $content);
		$lines = array_filter($lines, function($line) {
			return trim($line);
		});
		$content = implode(PHP_EOL, $lines);

		echo $content;
//		echo "\\clearpage";
	}
}
