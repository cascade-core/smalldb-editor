<?php
/*
 * Copyright (c) 2015, Josef Kufner  <josef@kufner.cz>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */


function TPL_html5__smalldb_editor__training_dummy($t, $id, $d, $so)
{
	echo "\t<!-- Smalldb Editor plugin -->\n",
		"\t<link rel=\"stylesheet\" href=\"//maxcdn.bootstrapcdn.com/font-awesome/4.2.0/css/font-awesome.min.css\" type=\"text/css\">\n",
		"\t<link rel=\"stylesheet\" href=\"/plugin/smalldb_editor/css/smalldb_editor.css\" type=\"text/css\">\n",
		"\t<script type=\"text/javascript\" src=\"https://code.jquery.com/jquery-2.1.1.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/jquery/gettext.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/geometry.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/spline.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/tarjan.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/state.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/action.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/transition.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/editor.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/canvas.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/storage.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/toolbar.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/classes/smalldb_editor.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/smalldb_editor.js\"></script>\n",
		"\t<script type=\"text/javascript\" src=\"/plugin/smalldb_editor/js/init.js\"></script>\n",
		"\n";
	echo "<h2>Smalldb Editor</h2>\n";
	echo "<textarea id=\"", htmlspecialchars($id), "\" class=\"smalldb_editor\" cols=\"25\" rows=\"80\" style=\"display: block; width: 99%; height: 400px;\">",
		json_encode($d, JSON_HEX_TAG | JSON_HEX_AMP | JSON_NUMERIC_CHECK | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
		"</textarea>";
}

